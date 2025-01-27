import { ClientProxy } from '@nestjs/microservices';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Inject,
  Put,
  Post,
  UploadedFiles,
  BadRequestException,
  UseInterceptors,
  NotFoundException,
  UseGuards,
  Patch,
  Request,
  Req,
} from '@nestjs/common';

import { Role, TransporterProviders } from '@lib/fabzen-common/types';
import {
  ApiMultipartFormData,
  ApiValidatedOkResponse,
  Authorize,
  UserID,
} from '@lib/fabzen-common/decorators';
import { WalletDto } from '@lib/fabzen-common/dtos/user.common.dto';

import { UserProvider } from 'apps/user/src/user.provider';
import {
  AadhaarKycResponseDto,
  UpdateUserDto,
  UserDto,
  AadhaarOtpVerifyRequestDto,
  KycResponseDto,
  CreateReferralDto,
  AadhaarOtpRequestDto,
  UpdateDeviceDto,
  BlockUserRequestDto,
  FeedbackMessageDto,
} from './users.dto';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { UserRoleGuard } from '../../guards/user-role.guard';
import { getClientIp } from '@supercharge/request-ip';
import { UpdateRolesRequestDto } from '../auth/auth.dto';
import { AuthProvider } from 'apps/auth/src/auth.provider';
import { CbrGameHistoryRepository } from 'apps/cbr-gameplay/src/cbr-gameplay.repository';

@ApiBearerAuth()
@ApiTags('Users')
@Controller()
export class UsersController {
  private readonly userProvider: UserProvider;
  private readonly walletProvider: WalletProvider;
  private readonly authProvider: AuthProvider;

  constructor(
    @Inject(TransporterProviders.USER_SERVICE)
    private readonly userClient: ClientProxy,
    @Inject(TransporterProviders.WALLET_SERVICE)
    private readonly walletClient: ClientProxy,
    @Inject(TransporterProviders.AUTH_SERVICE)
    private readonly authClient: ClientProxy,
    private readonly userRepository: UserRepository,
    private readonly gameHistoryRepository: CbrGameHistoryRepository,
  ) {
    this.userProvider = new UserProvider(this.userClient);
    this.walletProvider = new WalletProvider(this.walletClient);
    this.authProvider = new AuthProvider(this.authClient);
  }

  @Get('/me')
  @ApiOperation({ summary: 'Get My User Info' })
  @ApiValidatedOkResponse(UserDto)
  async getMyUser(@Req() request: Request, @UserID() userId: string) {
    const ipAddress = getClientIp(request);
    const user = await this.userRepository.getUser(userId);
    if (!user) {
      throw new NotFoundException(`User Not Found ${userId}`);
    }
    const availableFreeGameCount =
      await this.userRepository.availableFreeGameCount(userId);
    const isConvertedToPro = !user.build?.isPlayStoreBuild;
    await this.userRepository.updateIp(userId, ipAddress as string);
    return {
      isFreeGameAvailable: availableFreeGameCount > 0,
      availableFreeGameCount,
      isConvertedToPro,
      ...user,
    };
  }

  @Post('/feedback')
  @ApiOperation({ summary: 'Post Feedback' })
  async postFeedback(@Body() feedBackDto: FeedbackMessageDto) {
    console.log({ feedBackDto });
  }

  @Put('/me')
  @ApiOperation({ summary: 'Update My User Info' })
  async updateMyUser(
    @Body() updateUserDto: UpdateUserDto,
    @UserID() userId: string,
  ) {
    return await this.userProvider.updateUser({
      userId,
      ...updateUserDto,
    });
  }

  @Put('/update-device')
  @ApiOperation({ summary: 'Update Device Info' })
  async updateDevice(@Body() updateDeviceDto: UpdateDeviceDto) {
    // Dummy implementation for now
    console.log({ updateDeviceDto });
  }

  @Get('/wallet')
  @ApiOperation({ summary: 'Get User wallet' })
  @ApiValidatedOkResponse(WalletDto)
  async getWallet(@UserID() userId: string) {
    return await this.userRepository.getUserWallet(userId);
  }

  @Post('/upload-kyc')
  @ApiOperation({ summary: 'Upload KYC documents' })
  @ApiMultipartFormData([{ name: 'files', type: 'files', required: true }])
  @ApiValidatedOkResponse(KycResponseDto)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'frontImage', maxCount: 1 }]))
  async uploadKyc(
    @UploadedFiles()
    files: { frontImage: Express.Multer.File[] },
    @UserID() userId: string,
  ) {
    const panFrontImage = files.frontImage[0];
    return await this.userProvider.uploadKyc(userId, [panFrontImage]);
  }

  @Post('/aadhaar-kyc')
  @ApiOperation({ summary: ' aadhaar Otp Request ' })
  @ApiValidatedOkResponse(AadhaarKycResponseDto)
  async getCliendId(
    @Body() { aadhaarId }: AadhaarOtpRequestDto,
    @UserID() userId: string,
  ) {
    return await this.userProvider.generateAadhaarOtp({ aadhaarId, userId });
  }

  @Post('/aadhaar-otp-verify')
  @ApiOperation({ summary: 'aadhaar Otp Verify' })
  @ApiValidatedOkResponse(KycResponseDto)
  async otpVerify(
    @UserID() userId: string,
    @Body() aadhaarOtpVerifyRequestDto: AadhaarOtpVerifyRequestDto,
  ) {
    return await this.userProvider.submitAadhaarOtp({
      userId,
      ...aadhaarOtpVerifyRequestDto,
    });
  }

  @Post('/create-referral')
  @ApiOperation({ summary: 'Create referral' })
  async referral(
    @UserID() userId: string,
    @Body() { isReferred, referralCode }: CreateReferralDto,
  ) {
    if (isReferred && !referralCode) {
      throw new BadRequestException('Please enter the referral code');
    }
    return await this.userProvider.createReferral({
      userId,
      isReferred,
      referralCode,
    });
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Patch('/change-block-status')
  @ApiOperation({ summary: 'Block or Unblock a user' })
  async changeBlockStatus(
    @Body() { userId, shouldBlock }: BlockUserRequestDto,
  ) {
    await this.userRepository.changeBlockStatus(userId, shouldBlock);
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Patch('/roles')
  @ApiOperation({ summary: 'Admin Update Role' })
  async updateRoles(@Body() body: UpdateRolesRequestDto) {
    await this.authProvider.updateRoles(body);
  }
}
