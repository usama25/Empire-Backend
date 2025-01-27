import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { config } from '@lib/fabzen-common/configuration';
import {
  BuildInfoDto,
  DeviceDto,
} from '@lib/fabzen-common/dtos/user.common.dto';
import { testBuildInfo, testDevice } from '@lib/fabzen-common/jest/stubs';

export class InitAuthRequestDto {
  @IsOptional()
  @IsString()
  countryCode: string = config.auth.defaultCountryCode;

  @IsNotEmpty()
  @IsNumberString()
  @Length(10, 10)
  @ApiProperty({ default: '1234567890' })
  mobileNo: string;

  @IsNotEmpty()
  @IsNotEmptyObject()
  @Type(() => BuildInfoDto)
  @ValidateNested()
  @ApiProperty({
    default: testBuildInfo,
  })
  build: BuildInfoDto;
}

export class InitAuthResponseDto {
  @Expose()
  @IsDateString()
  expiresAt: string;
}

export class VerifyAuthRequestDto {
  @IsOptional()
  @IsString()
  countryCode: string = config.auth.defaultCountryCode;

  @IsNotEmpty()
  @IsNumberString()
  @Length(10, 10)
  @ApiProperty({ default: '1234567890' })
  mobileNo: string;

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
  @Expose()
  @IsNotEmpty()
  @IsString()
  userId: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}

export class UpdateRolesRequestDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsArray()
  @IsNotEmpty()
  roles: string[];
}
