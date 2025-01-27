import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import {
  TransporterCmds,
  MobileNumber,
  UpdateStatsDto,
  UserID,
} from '@lib/fabzen-common/types';

import {
  UpdateUserDto,
  OtpVerifyRequestDto,
  CreateReferralDto,
} from './infrastructure/controllers/dtos/user.transporter.dto';
import {
  AadhaarKycResponseDto,
  AadhaarIdDto,
  KycResponseDto,
} from 'apps/rest-api/src/subroutes/user/users.dto';
import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';
import { UserEntity } from '@lib/fabzen-common/entities';

export class UserProvider extends MicroserviceProvider {
  async createOrUpdateUser(mobileNumber: MobileNumber, build: BuildInfoDto) {
    return this._sendRequest<string>(TransporterCmds.CREATE_OR_UPDATE_USER, {
      mobileNumber,
      build,
    });
  }

  async checkIfFirstLogin(mobileNumber: MobileNumber) {
    return this._sendRequest<boolean>(TransporterCmds.CHECK_IF_FIRST_LOGIN, {
      mobileNumber,
    });
  }

  async updateUser(updateUserDto: UpdateUserDto) {
    return this._sendRequest<string>(
      TransporterCmds.UPDATE_USER,
      updateUserDto,
    );
  }

  async uploadKyc(userId: string, files: Express.Multer.File[]) {
    return this._sendRequest<KycResponseDto>(
      TransporterCmds.UPLOAD_KYC,
      { userId },
      files,
    );
  }

  async updateDeviceInfo(updateUserDeviceDto: UpdateUserDto) {
    return this._sendRequest<UpdateUserDto>(
      TransporterCmds.UPDATE_USER_DEVICE,
      updateUserDeviceDto,
    );
  }

  async generateAadhaarOtp(aadhaarIdDto: AadhaarIdDto) {
    return this._sendRequest<AadhaarKycResponseDto>(
      TransporterCmds.GET_CLIENT_ID,
      aadhaarIdDto,
    );
  }

  async submitAadhaarOtp(otpVerifyRequestDto: OtpVerifyRequestDto) {
    return this._sendRequest<KycResponseDto>(
      TransporterCmds.KYC_OTP_VERIFY,
      otpVerifyRequestDto,
    );
  }

  async createReferral(createReferralDto: CreateReferralDto) {
    return this._sendRequest(
      TransporterCmds.CREATE_REFERRAL,
      createReferralDto,
    );
  }

  async getUserNameProfilePicList(userIds: string[]) {
    return await this._sendRequest(TransporterCmds.GET_USER_PROFILE_PIC_LIST, {
      userIds,
    });
  }

  async updateUserStats(updateStatsDto: UpdateStatsDto) {
    await this._sendRequest(TransporterCmds.UPDATE_STATS, updateStatsDto);
  }

  async getUser(userId: UserID) {
    return await this._sendRequest<UserEntity>(TransporterCmds.GET_USER, {
      userId,
    });
  }
}
