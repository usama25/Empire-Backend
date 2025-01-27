import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIP,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

import { config } from '@lib/fabzen-common/configuration';
import {
  BuildInfoDto,
  DeviceDto,
  MobileNumberDto,
} from '@lib/fabzen-common/dtos/user.common.dto';
import { testDevice } from '@lib/fabzen-common/jest/stubs';

export class InitAuthRequestDto {
  @IsOptional()
  @IsIP()
  ip: string | undefined;

  @Type(() => MobileNumberDto)
  @ValidateNested()
  mobileNumber: MobileNumberDto;

  @IsNotEmpty()
  @IsNotEmptyObject()
  @Type(() => BuildInfoDto)
  @ValidateNested()
  build: BuildInfoDto;
}

export class VerifyAuthRequestDto {
  @Type(() => MobileNumberDto)
  @ValidateNested()
  mobileNumber: MobileNumberDto;

  @IsNotEmpty()
  @IsString()
  ipAddress: string | undefined;

  @IsNotEmpty()
  @IsString()
  @Length(config.auth.otp.length, config.auth.otp.length)
  @ApiProperty({ default: '123456' })
  otp: string;

  @IsNotEmpty()
  @IsNotEmptyObject()
  @Type(() => DeviceDto)
  @ValidateNested()
  @ApiProperty({
    default: testDevice,
  })
  device: DeviceDto;
}

export class VerifyAuthResponseDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  accessToken: string;
}
