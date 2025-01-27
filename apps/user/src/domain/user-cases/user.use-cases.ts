import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import {
  File,
  KycCardType,
  S3FileUploadResponse,
  TransporterProviders,
  UpdateStatsDto,
} from '@lib/fabzen-common/types';
import { UserEntity } from '@lib/fabzen-common/entities';
import { S3Util } from '@lib/fabzen-common/utils/s3.util';
import { KycDataDto, KycDto } from '@lib/fabzen-common/dtos/user.common.dto';
import { config } from '@lib/fabzen-common/configuration';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

import {
  AadhaarKycResponseDto,
  AadhaarIdDto,
  KycResponseDto,
} from 'apps/rest-api/src/subroutes/user/users.dto';
import { NotificationProvider } from 'apps/notification/src/notification.provider';
import {
  CreateUserDto,
  CheckIfFirstLoginDto,
  OtpVerifyRequestDto,
  UpdateUserDto,
  CreateReferralDto,
} from '../../infrastructure/controllers/dtos/user.transporter.dto';
import {
  PanUploadResponse,
  SubmitOtpResponse,
  GenerateOtpResponse,
} from '../../infrastructure/gateways';
import {
  SurepassGateway,
  UserRepository,
  WalletRepository,
} from '../interfaces';
import { AppsflyerEventNames } from '@lib/fabzen-common/types/notification.types';

@Injectable()
export class UserUseCases {
  private readonly s3Util: S3Util;
  private readonly notificationProvider: NotificationProvider;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly surepassGateway: SurepassGateway,
    private readonly walletRepository: WalletRepository,
    private readonly remoteConfigService: RemoteConfigService,
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
  ) {
    this.s3Util = new S3Util();
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );
  }

  async createOrUpdateUser({
    mobileNumber,
    build,
  }: CreateUserDto): Promise<string> {
    // Fire converted_to_pro inapp event
    const user = await this.userRepository.getUserByMobileNumber(mobileNumber);
    const isPreviouslyBaseBuild = !!user?.build && user.build.isPlayStoreBuild;

    const userId = await this.userRepository.createOrUpdateUser(
      mobileNumber,
      build,
    );
    await this.walletRepository.expireBonus(userId);
    if (isPreviouslyBaseBuild && !build.isPlayStoreBuild) {
      // Convert to Pro
      this.notificationProvider.sendInAppEvent(
        userId,
        AppsflyerEventNames.convertedToPro,
      );
    }
    return userId;
  }

  async checkIfFirstLogin({
    mobileNumber,
  }: CheckIfFirstLoginDto): Promise<boolean> {
    return await this.userRepository.checkIfFirstLogin(mobileNumber);
  }
  async getUsers(userIds: string[]): Promise<UserEntity[]> {
    return await this.userRepository.getUsers(userIds);
  }

  async updateUser(updateUserDto: UpdateUserDto): Promise<void> {
    await this.userRepository.updateUser(updateUserDto);
  }

  async updateUserDevice(updateUserDeviceDto: UpdateUserDto): Promise<void> {
    await this.#updateDevice(updateUserDeviceDto);
  }

  async uploadKyc(userId: string, files: File[]): Promise<KycResponseDto> {
    try {
      const response: PanUploadResponse =
        await this.surepassGateway.uploadKyc(files);
      const isEligible = await this.#checkKycInfoEligibility(
        KycCardType.pan,
        response.data.ocr_fields[0].pan_number.value,
      );
      if (!isEligible) {
        return {
          status: false,
          message: 'PAN is already registered with other numbers',
        };
      }
      if (this.#checkIfUnderAge18(response.data.ocr_fields[0].dob.value)) {
        const kycResponseDto: KycResponseDto = {
          status: false,
          message: 'User is under age 18.',
        };
        return kycResponseDto;
      }
      let imageUrl = 'https://default/';

      if (!config.isJest) {
        const uploadResponse: S3FileUploadResponse[] =
          await this.s3Util.uploadFiles(files, config.user.kycBucketName);
        imageUrl = uploadResponse[0].url;
      }

      const kycData: KycDataDto = {
        imageUrl,
        dob: response.data.ocr_fields[0].dob.value,
        cardType: KycCardType.pan,
        cardNumber: response.data.ocr_fields[0].pan_number.value,
      };
      await this.updateUser({
        userId,
        name: response.data.ocr_fields[0].full_name.value,
      });
      await this.#updateKyc(userId, kycData);
      const kycResponseDto: KycResponseDto = {
        status: true,
        message: 'Success',
      };
      return kycResponseDto;
    } catch {
      return {
        status: false,
        message: 'Wrong Image',
      };
    }
  }

  async generateOtp({
    aadhaarId,
  }: AadhaarIdDto): Promise<AadhaarKycResponseDto> {
    const isEligible = await this.#checkKycInfoEligibility(
      KycCardType.aadhaar,
      aadhaarId,
    );
    if (!isEligible) {
      throw new BadRequestException(
        'Aadhaar is already registered with other numbers.',
      );
    }
    const response: GenerateOtpResponse =
      await this.surepassGateway.generateOtp(aadhaarId);
    if (response.status_code === 200 && response.success) {
      return { clientId: response.data.client_id };
    } else {
      throw new BadRequestException('Invalid Aadhaar.');
    }
  }

  async submitOtp(
    otpVerifyRequestDto: OtpVerifyRequestDto,
  ): Promise<KycResponseDto> {
    try {
      const { userId, clientId, otp } = otpVerifyRequestDto;
      const response: SubmitOtpResponse = await this.surepassGateway.submitOtp(
        clientId,
        otp,
      );
      if (this.#checkIfUnderAge18(response.data.dob)) {
        const kycResponseDto: KycResponseDto = {
          status: false,
          message: 'User is under age 18.',
        };
        return kycResponseDto;
      }
      const imageUrl = response.data.profile_image;
      const kycData: KycDataDto = {
        imageUrl,
        dob: response.data.dob,
        cardType: KycCardType.aadhaar,
        cardNumber: response.data.aadhaar_number,
      };
      await this.updateUser({ userId, name: response.data.full_name });
      await this.#updateKyc(userId, kycData);
      const kycResponseDto: KycResponseDto = {
        status: true,
        message: 'success',
      };
      return kycResponseDto;
    } catch (error) {
      return {
        status: false,
        message: error.message,
      };
    }
  }

  async createReferral(createReferralDto: CreateReferralDto) {
    const { userId, referralCode, isReferred } = createReferralDto;
    let referredUserId: string | undefined;
    if (isReferred) {
      referredUserId = await this.userRepository.getUserByReferralCode(
        referralCode as string,
      );
      if (referredUserId) {
        const user = (await this.userRepository.getUser(userId)) as UserEntity;
        if (user.referral.canBeReferred) {
          if (user.userId === referredUserId) {
            throw new BadRequestException('Can not refer himself.');
          } else {
            const referralBonus = this.#getReferralBonus();
            await this.walletRepository.creditReferralBonus(
              userId,
              referredUserId,
              referralBonus,
            );
          }
        } else {
          throw new BadRequestException('This user has already been referred');
        }
      } else {
        throw new BadRequestException('No User With Such Referral Code.');
      }
    }
    await this.userRepository.createReferral(
      userId,
      isReferred,
      referredUserId,
    );
  }

  #getReferralBonus(): string {
    return this.remoteConfigService.getReferralBonus();
  }

  #checkIfUnderAge18(dobString: string): boolean {
    let parts, day, month, year;
    if (dobString.includes('/')) {
      parts = dobString.split('/');
      day = Number.parseInt(parts[0], 10);
      month = Number.parseInt(parts[1], 10) - 1;
      year = Number.parseInt(parts[2], 10);
    } else {
      parts = dobString.split('-');
      year = Number.parseInt(parts[0], 10);
      month = Number.parseInt(parts[1], 10) - 1;
      day = Number.parseInt(parts[2], 10);
    }
    const birthday = new Date(year, month, day);
    const age = this.#calculateAge(birthday);
    if (age < 18) {
      return true;
    }
    return false;
  }

  #calculateAge(birthday: Date) {
    const today = new Date();
    const age =
      today.getFullYear() -
      birthday.getFullYear() -
      Number(
        today.getMonth() < birthday.getMonth() ||
          (today.getMonth() === birthday.getMonth() &&
            today.getDate() < birthday.getDate()),
      );
    return age;
  }

  async #getkycLimitPerDocument(userId: string): Promise<number> {
    const user = await this.userRepository.getUser(userId);
    return user?.kycModifiedCount as number;
  }

  async #updateKyc(userId: string, kycData: KycDataDto) {
    const modifiedCount = await this.#getkycLimitPerDocument(userId);
    const kyc: KycDto = {
      status: true,
      modifiedCount: modifiedCount + 1,
      data: kycData,
    };
    const updateUserDto = {
      userId,
      kyc,
    };
    await this.userRepository.updateUser(updateUserDto as UpdateUserDto);
  }

  async #updateDevice(updateUserDeviceDto: UpdateUserDto) {
    await this.userRepository.updateUserDevice(
      updateUserDeviceDto as UpdateUserDto,
    );
  }

  async #checkKycInfoEligibility(
    cardType: KycCardType,
    cardNumber: string,
  ): Promise<boolean> {
    const sameKycUserCount = await this.userRepository.countUserWithSameKycInfo(
      cardType,
      cardNumber,
    );
    const allowedCount = this.remoteConfigService.getKycLimit();
    return sameKycUserCount < allowedCount;
  }

  async getUserNameProfilePicList(userIds: string[]) {
    return await this.userRepository.getUsers(userIds);
  }

  async getUser(userId: string) {
    return await this.userRepository.getUser(userId);
  }

  async updateUserStats(updateStats: UpdateStatsDto): Promise<void> {
    await this.userRepository.updateUserStats(updateStats);
  }
}
