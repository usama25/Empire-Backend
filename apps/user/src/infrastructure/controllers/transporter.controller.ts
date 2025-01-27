import { Controller, NotFoundException, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import {
  TransporterCmds,
  File,
  UpdateStatsDto,
} from '@lib/fabzen-common/types';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { MessageAttachments, MessageData } from '@lib/fabzen-common/decorators';
import { UserEntity } from '@lib/fabzen-common/entities';

import {
  AadhaarKycResponseDto,
  AadhaarIdDto,
  KycResponseDto,
} from 'apps/rest-api/src/subroutes/user/users.dto';
import { UserUseCases } from '../../domain/user-cases/user.use-cases';
import {
  CreateUserDto,
  CheckIfFirstLoginDto,
  OtpVerifyRequestDto,
  UpdateUserDto,
  CreateReferralDto,
} from './dtos/user.transporter.dto';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class UserTransporterController {
  constructor(private readonly userUsercases: UserUseCases) {}

  @MessagePattern(TransporterCmds.CREATE_OR_UPDATE_USER)
  async createUser(
    @MessageData() createUserDto: CreateUserDto,
  ): Promise<string> {
    return await this.userUsercases.createOrUpdateUser(createUserDto);
  }

  @MessagePattern(TransporterCmds.CHECK_IF_FIRST_LOGIN)
  async checkIfFirstLogin(
    @MessageData() checkIfFirstLoginDto: CheckIfFirstLoginDto,
  ): Promise<boolean> {
    return await this.userUsercases.checkIfFirstLogin(checkIfFirstLoginDto);
  }

  @MessagePattern(TransporterCmds.UPDATE_USER)
  async updateUser(
    @MessageData() updateUserDto: UpdateUserDto,
  ): Promise<string> {
    await this.userUsercases.updateUser(updateUserDto);
    return updateUserDto.userId;
  }

  @MessagePattern(TransporterCmds.UPDATE_USER_DEVICE)
  async updateUserDevice(
    @MessageData() updateUserDeviceDto: UpdateUserDto,
  ): Promise<void> {
    await this.userUsercases.updateUserDevice(updateUserDeviceDto);
  }

  @MessagePattern(TransporterCmds.GET_USER_PROFILE_PIC_LIST)
  async getUserNameProfilePicList(
    @MessageData() { userIds }: { userIds: string[] },
  ): Promise<UserEntity[]> {
    return await this.userUsercases.getUserNameProfilePicList(userIds);
  }

  @MessagePattern(TransporterCmds.UPLOAD_KYC)
  async uploadKyc(
    @MessageData()
    { userId }: { userId: string },
    @MessageAttachments() files: File[],
  ): Promise<KycResponseDto> {
    return await this.userUsercases.uploadKyc(userId, files);
  }

  @MessagePattern(TransporterCmds.GET_CLIENT_ID)
  async generateOtp(
    @MessageData() aahdaarIdDto: AadhaarIdDto,
  ): Promise<AadhaarKycResponseDto> {
    return await this.userUsercases.generateOtp(aahdaarIdDto);
  }

  @MessagePattern(TransporterCmds.KYC_OTP_VERIFY)
  async submitOtp(
    @MessageData() otpVerifyRequestDto: OtpVerifyRequestDto,
  ): Promise<KycResponseDto> {
    return await this.userUsercases.submitOtp(otpVerifyRequestDto);
  }

  @MessagePattern(TransporterCmds.CREATE_REFERRAL)
  async createReferral(@MessageData() createReferralDto: CreateReferralDto) {
    await this.userUsercases.createReferral(createReferralDto);
  }

  @MessagePattern(TransporterCmds.GET_USER)
  async getUserDetails(
    @MessageData() { userId }: { userId: string },
  ): Promise<UserEntity> {
    const user = await this.userUsercases.getUser(userId);
    if (!user) {
      throw new NotFoundException(`User Not Found ${userId}`);
    }
    return user;
  }

  @MessagePattern(TransporterCmds.UPDATE_STATS)
  async updateUserStats(
    @MessageData() updateStats: UpdateStatsDto,
  ): Promise<void> {
    await this.userUsercases.updateUserStats(updateStats);
  }
}
