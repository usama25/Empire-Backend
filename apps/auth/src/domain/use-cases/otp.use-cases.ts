import * as dayjs from 'dayjs';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { getRandomString } from '@lib/fabzen-common/utils/random.utils';
import { Otp, Role, MobileNumber } from '@lib/fabzen-common/types';
import { AuthEntity } from '@lib/fabzen-common/entities';
import {
  BuildInfoDto,
  DeviceDto,
} from '@lib/fabzen-common/dtos/user.common.dto';

import { OtpSmsService } from 'apps/notification/src/domain/interfaces';
import { AuthRepository, UserRepository } from '../interfaces';
import { UpdateRolesRequestDto } from 'apps/rest-api/src/subroutes/auth/auth.dto';
import {
  sendAppInstallEventToMeta,
  sendRegistrationEventToMeta,
} from '@lib/fabzen-common/utils/meta.util';
import { getCountryFromMobileNumber } from '@lib/fabzen-common/utils/mobile-number.utils';
type RequestOtpResponse = {
  expiresAt: dayjs.Dayjs;
};

type VerifyOtpResult = {
  userId?: string;
  roles: Role[];
};

@Injectable()
export class OtpUseCases {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly userRepository: UserRepository,
    private readonly otpSmsService: OtpSmsService,
  ) {}

  async requestNewOtp(
    mobileNumber: MobileNumber,
    buildInfo: BuildInfoDto,
  ): Promise<RequestOtpResponse> {
    this.#validateTesterNumber(mobileNumber, buildInfo.isPlayStoreBuild);
    const authEntity =
      await this.authRepository.getAuthByMobileNumber(mobileNumber);
    if (authEntity) {
      if (buildInfo.isPlayStoreBuild) {
        try {
          this.#rejectFreeBuildForProUsers(authEntity);
        } catch (error) {
          await this.otpSmsService.sendDownloadLinkSms(mobileNumber);
          throw error;
        }
      }
      this.#rejectTooManyAttempts(authEntity);
    }
    const { code, expiresAt } = this.#getOtpCodeWithExpirationToSend(
      mobileNumber,
      authEntity,
    );
    await this.#storeOtpCode(
      authEntity,
      mobileNumber,
      code,
      expiresAt,
      buildInfo,
    );
    const { isPlayStoreBuild, isGlobalBuild } = buildInfo;
    if (!config.isLocal) {
      this.#sendOtpCode(mobileNumber, code, isPlayStoreBuild, isGlobalBuild);
    }

    return { expiresAt };
  }

  async verifyAndUseOtp(
    mobileNumber: MobileNumber,
    ipAddress: string | undefined,
    otp: string,
    device: DeviceDto,
  ): Promise<Required<VerifyOtpResult>> {
    const authEntity =
      await this.authRepository.getAuthByMobileNumber(mobileNumber);
    this.#rejectIneligibleOtpVerification(authEntity);
    const verificationResult = await this.#verifyOtp(
      authEntity as AuthEntity,
      otp,
    );
    const { roles } = verificationResult;
    const { build } = authEntity as AuthEntity;
    //check if this login is the first time before creating user data on DB
    const checkIfFirstLogin =
      await this.userRepository.checkIfFirstLogin(mobileNumber);

    const userId = await this.userRepository.createOrUpdateUser(
      mobileNumber,
      build,
    );

    if (verificationResult.userId !== userId) {
      await this.authRepository.attachUserId(mobileNumber, userId);
    }

    await this.userRepository.updateDeviceInfo({
      userId,
      deviceInfo: device,
    });

    //send evets to meta server
    const country = getCountryFromMobileNumber(mobileNumber)
      .slice(0, 2)
      .toLowerCase();

    //send installApp event to meta server only when user logs in for the first time
    if (checkIfFirstLogin) {
      sendAppInstallEventToMeta(
        userId,
        String(ipAddress || '0.0.0.0'),
        country,
        mobileNumber.number,
      );
    }
    sendRegistrationEventToMeta(
      userId,
      String(ipAddress || '0.0.0.0'),
      country,
      mobileNumber.number,
    );

    return { userId, roles };
  }

  #rejectFreeBuildForProUsers(authEntity: AuthEntity) {
    if (!authEntity.build.isPlayStoreBuild) {
      throw new HttpException(
        {
          statusCode: 402,
          message: "Can't use Playstore Build",
        },
        402,
      );
    }
  }

  #rejectTooManyAttempts(authEntity: AuthEntity) {
    const { sentCount } = authEntity.otp as Otp;
    const { maxRetries } = config.auth.otp;

    if (sentCount > maxRetries) {
      throw new BadRequestException(
        'You have exceeded the maximum number of OTP requests',
      );
    }
  }

  #validateTesterNumber(mobileNumber: MobileNumber, isPlayStoreBuild: boolean) {
    const { number } = mobileNumber;
    const allWhiteListedNumbers = this.#getAllWhiteListedNumbers();
    if (!allWhiteListedNumbers.includes(number)) {
      return;
    }

    const { whilteList } = config.auth.otp;
    if (isPlayStoreBuild) {
      if (!whilteList.playstore.includes(number)) {
        throw new HttpException(
          {
            statusCode: 402,
            message: "Can't use Playstore Build",
          },
          402,
        );
      }
    } else if (!whilteList.website.includes(number)) {
      throw new HttpException(
        {
          statusCode: 402,
          message: "Can't use Landing Build",
        },
        402,
      );
    }
  }

  #getOtpCodeWithExpirationToSend(
    mobileNumber: MobileNumber,
    authEntity: AuthEntity | undefined,
  ): {
    code: string;
    expiresAt: dayjs.Dayjs;
  } {
    if (this.#isOldOtpAvailable(authEntity)) {
      const { code, expiresAt } = authEntity?.otp as Otp;
      return { code, expiresAt };
    } else {
      const code = this.#getOtpCode(mobileNumber);
      const expiresAt = dayjs().add(
        config.auth.otp.expirationInMinutes,
        'minute',
      );
      return { code, expiresAt };
    }
  }

  #isOldOtpAvailable(authEntity: AuthEntity | undefined): boolean {
    return (
      !!authEntity?.otp &&
      !authEntity.otp.used &&
      dayjs().isBefore(authEntity.otp.expiresAt)
    );
  }

  #getOtpCode(mobileNumber: MobileNumber): string {
    return this.#shouldUseDevOtp(mobileNumber)
      ? config.auth.otp.devOtp
      : this.#generateNewOtpCode();
  }

  #shouldUseDevOtp(mobileNumber: MobileNumber): boolean {
    const allWhiteListedNumbers = this.#getAllWhiteListedNumbers();
    return (
      config.isDevelopment ||
      allWhiteListedNumbers.includes(mobileNumber.number)
    );
  }

  #getAllWhiteListedNumbers(): string[] {
    const { whilteList } = config.auth.otp;
    return [...whilteList.playstore, ...whilteList.website];
  }

  #generateNewOtpCode(): string {
    return getRandomString(config.auth.otp.length, '1234567890');
  }

  async #storeOtpCode(
    authEntity: AuthEntity | undefined,
    mobileNumber: MobileNumber,
    code: string,
    expiresAt: dayjs.Dayjs,
    buildInfo: BuildInfoDto,
  ) {
    const newOtp: Otp = {
      code,
      used: false,
      expiresAt,
      sentCount: 1,
      lastSentAt: dayjs(),
      failedAttempts: 0,
    };
    if (authEntity) {
      if (authEntity.otp) {
        newOtp.sentCount = authEntity.otp.sentCount + 1;
      }
      authEntity.otp = newOtp;
      authEntity.build = buildInfo;
      await this.authRepository.updateOtp(mobileNumber, newOtp, buildInfo);
    } else {
      const newAuth = new AuthEntity(
        mobileNumber,
        [Role.player],
        buildInfo,
        newOtp,
      );
      await this.authRepository.createAuth(newAuth);
    }
  }

  #sendOtpCode(
    mobileNumber: MobileNumber,
    code: string,
    isPlayStoreBuild: boolean,
    isGlobalBuild: boolean,
  ) {
    this.otpSmsService.sendOtp(
      mobileNumber,
      code,
      isPlayStoreBuild,
      isGlobalBuild,
    );
  }

  #rejectIneligibleOtpVerification(authEntity: AuthEntity | undefined) {
    if (!(authEntity?.otp && !authEntity.otp.used)) {
      throw new BadRequestException('Please resend OTP');
    }
    const { otp } = authEntity;
    if (otp.failedAttempts >= config.auth.otp.continuousFailureLimit) {
      throw new BadRequestException('Too many failed attempts');
    }
  }

  async #verifyOtp(
    authEntity: AuthEntity,
    sentOtp: string,
  ): Promise<VerifyOtpResult> {
    const otp = authEntity.otp as Otp;
    const { mobileNumber, roles, userId } = authEntity;
    let isVerified = false;
    if (sentOtp === otp.code) {
      otp.sentCount = 0;
      otp.used = true;
      isVerified = true;
    } else {
      otp.failedAttempts++;
    }
    await this.authRepository.updateOtp(mobileNumber, otp);
    if (!isVerified) {
      throw new BadRequestException('Incorrect OTP!');
    }
    return {
      userId,
      roles,
    };
  }

  async updateRoles(body: UpdateRolesRequestDto) {
    this.authRepository.updateRoles(body);
  }
}
