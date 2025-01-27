import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNotEmptyObject,
  IsString,
  ValidateNested,
} from 'class-validator';

import {
  BuildInfoDto,
  DeviceDto,
  KycDto,
  MobileNumberDto,
} from '@lib/fabzen-common/dtos/user.common.dto';
import {
  AadhaarOtpVerifyRequestDto,
  UpdateUserDto as UpdateUserHttpDto,
  CreateReferralDto as CreateReferralHtpDto,
} from 'apps/rest-api/src/subroutes/user/users.dto';

export class CreateUserDto {
  @Type(() => MobileNumberDto)
  @ValidateNested()
  mobileNumber: MobileNumberDto;

  @IsNotEmpty()
  @IsNotEmptyObject()
  @Type(() => BuildInfoDto)
  @ValidateNested()
  build: BuildInfoDto;
}

export class CheckIfFirstLoginDto {
  @Type(() => MobileNumberDto)
  @ValidateNested()
  mobileNumber: MobileNumberDto;
}

export class UpdateUserDto extends UpdateUserHttpDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  kyc?: KycDto;
  deviceInfo?: DeviceDto;
}

export class OtpVerifyRequestDto extends AadhaarOtpVerifyRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CreateReferralDto extends CreateReferralHtpDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
