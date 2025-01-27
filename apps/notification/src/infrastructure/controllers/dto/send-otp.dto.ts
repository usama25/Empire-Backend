import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

import { config } from '@lib/fabzen-common/configuration';
import { MobileNumberDto } from '@lib/fabzen-common/dtos/user.common.dto';

export class SendOtpRequestDto {
  @Type(() => MobileNumberDto)
  @ValidateNested()
  mobileNumber: MobileNumberDto;

  @IsNotEmpty()
  @IsString()
  @Length(config.auth.otp.length, config.auth.otp.length)
  otp: string;

  @IsNotEmpty()
  @IsBoolean()
  isPlayStoreBuild: boolean;

  @IsNotEmpty()
  @IsBoolean()
  isGlobalBuild: boolean;
}
