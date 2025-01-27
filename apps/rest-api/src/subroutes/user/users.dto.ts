import { Expose, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsNotEmpty,
  IsBoolean,
  IsNotEmptyObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import {
  AddressDto,
  BuildInfoDto,
  DeviceDto,
  ExternalIdsDto,
  MobileNumberDto,
  ReferralDto,
  StatsDto,
  WalletDto,
} from '@lib/fabzen-common/dtos/user.common.dto';
import {
  testAddress,
  testBuildInfo,
  testDevice,
  testEmail,
  testExternalIds,
  testMobileNumber,
  testObjectId,
  testReferral,
  testStats,
  testUserName,
  testWallet,
} from '@lib/fabzen-common/jest/stubs';
import { config } from '@lib/fabzen-common/configuration';

export class UserDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  userId: string = testObjectId;

  @Expose()
  @IsNotEmpty()
  @IsString()
  username: string = testUserName;

  @Expose()
  @IsOptional()
  @IsString()
  name: string = testUserName;

  @Expose()
  @IsNotEmpty()
  @Type(() => MobileNumberDto)
  @ValidateNested()
  mobileNumber: MobileNumberDto = testMobileNumber;

  @Expose()
  @IsNotEmpty()
  @Type(() => WalletDto)
  @ValidateNested()
  wallet: WalletDto = testWallet;

  @Expose()
  @IsNotEmpty()
  @Type(() => StatsDto)
  @ValidateNested()
  stats: StatsDto = testStats;

  @Expose()
  @IsNotEmpty()
  @Type(() => ReferralDto)
  @ValidateNested()
  referral: ReferralDto = testReferral;

  @Expose()
  // @IsNotEmpty()
  // @IsNumber()
  // @Min(0)
  // @Max(config.user.maxAvatarIndex)
  avatar: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  rank: number;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  isEmailVerified: boolean;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  isKycVerified: boolean;

  @Expose()
  @IsOptional()
  @IsString()
  email: string = testEmail;

  @Expose()
  @IsOptional()
  @Type(() => AddressDto)
  @ValidateNested()
  address: AddressDto = testAddress;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  isAddressValid: boolean;

  @Expose()
  @IsOptional()
  @Type(() => ExternalIdsDto)
  @ValidateNested()
  externalIds?: ExternalIdsDto = testExternalIds;

  @Expose()
  @IsOptional()
  @Type(() => BuildInfoDto)
  @ValidateNested()
  build: BuildInfoDto = testBuildInfo;

  @Expose()
  @IsBoolean()
  isProActive: boolean;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  isFreeGameAvailable: boolean;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  availableFreeGameCount: number;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  isConvertedToPro: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  address?: AddressDto;

  @IsOptional()
  device?: DeviceDto;

  @IsOptional()
  @Type(() => ExternalIdsDto)
  @ValidateNested()
  @ApiProperty({
    default: testExternalIds,
  })
  externalIds?: ExternalIdsDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(config.user.maxAvatarIndex)
  avatar?: number;

  @IsOptional()
  @Type(() => BuildInfoDto)
  @ValidateNested()
  @ApiProperty({
    default: testBuildInfo,
  })
  build?: BuildInfoDto;
}

export class UpdateDeviceDto {
  @IsNotEmpty()
  @IsNotEmptyObject()
  @Type(() => DeviceDto)
  @ValidateNested()
  @ApiProperty({
    default: testDevice,
  })
  device: DeviceDto;
}

export class AadhaarKycResponseDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  clientId: string;
}

export class AadhaarOtpRequestDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  aadhaarId: string;
}

export class AadhaarIdDto {
  @IsNotEmpty()
  @IsString()
  aadhaarId: string;

  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class AadhaarOtpVerifyRequestDto {
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}

export class KycResponseDto {
  @Expose()
  @IsBoolean()
  status: boolean;

  @Expose()
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class CreateReferralDto {
  @IsNotEmpty()
  @IsBoolean()
  isReferred: boolean;

  @IsOptional()
  @IsString()
  referralCode: string | undefined;
}

export class ReferralRequestDto {
  @IsString()
  referralCode: string;
}

export class BlockUserRequestDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    default: testObjectId,
  })
  userId: string;

  @IsNotEmpty()
  @IsBoolean()
  shouldBlock: boolean;
}

export class FeedbackMessageDto {
  @IsNotEmpty()
  @IsString()
  message: string;
}
