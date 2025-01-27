import { Expose } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumberString,
  IsString,
  IsOptional,
  IsNumber,
  Length,
  IsBoolean,
} from 'class-validator';
import { Games, Stat } from '../types';

export class BuildInfoDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  appVersion: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  appCode: string;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  isPlayStoreBuild: boolean;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  isGlobalBuild: boolean;

  @Expose()
  @IsOptional()
  @IsString()
  installSource?: string;

  @Expose()
  @IsOptional()
  @IsString()
  installChannel?: string;
}

export class MobileNumberDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @Expose()
  @IsNotEmpty()
  @IsNumberString()
  @Length(10, 10)
  number: string;
}

export class AddressDto {
  @Expose()
  @IsOptional()
  @IsString()
  address1: string;

  @Expose()
  @IsOptional()
  @IsString()
  address2: string;

  @Expose()
  @IsOptional()
  @IsString()
  city: string;

  @Expose()
  @IsOptional()
  @IsString()
  postalCode: string;

  @Expose()
  @IsOptional()
  @IsString()
  state: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  country: string;
}

export class DeviceDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @IsNotEmpty()
  @IsString()
  model: string;

  @IsNotEmpty()
  @IsString()
  os: string;

  @IsNotEmpty()
  @IsString()
  processor: string;

  @IsNotEmpty()
  @IsString()
  ram: string;

  @IsNotEmpty()
  @IsString()
  graphicsDeviceName: string;

  @IsNotEmpty()
  @IsNumber()
  graphicsDeviceID: number;
}

export class KycDataDto {
  @IsNotEmpty()
  @IsString()
  imageUrl: string;

  @IsNotEmpty()
  @IsString()
  cardNumber: string;

  @IsNotEmpty()
  @IsString()
  cardType: string;

  @IsNotEmpty()
  @IsString()
  dob: string;
}

export class KycDto {
  @IsBoolean()
  status: boolean;

  @IsNumber()
  modifiedCount: number;

  @IsNotEmpty()
  data: KycDataDto;
}

export class ExternalIdsDto {
  @Expose()
  @IsOptional()
  @IsString()
  googleAdvertisingId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  oneSignalId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  afId?: string;

  @IsOptional()
  @IsString()
  proAfId?: string;

  @IsOptional()
  @IsString()
  baseAfId?: string;
}

export class WalletDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  main: string = '10';

  @Expose()
  @IsNotEmpty()
  @IsString()
  win: string = '1';

  @Expose()
  @IsNotEmpty()
  @IsString()
  bonus: string = '50';
}

export class StatsDto {
  @Expose()
  [Games.ludo]?: Stat;

  @Expose()
  [Games.skillpatti]?: Stat;

  @Expose()
  [Games.callbreak]?: Stat;

  @Expose()
  [Games.snakeAndLadders]?: Stat;

  @Expose()
  [Games.ludoMegaTournament]?: Stat;

  @Expose()
  [Games.rummyempire]?: Stat;

  @Expose()
  [Games.aviator]?: Stat;
}

export class ReferralDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  code: string;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  count: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  earning: number;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  canBeReferred: boolean;
}

export class UpdateBuildInfoDto {
  @Expose()
  @IsOptional()
  @IsBoolean()
  isPlayStoreBuild?: boolean;

  @Expose()
  @IsOptional()
  @IsString()
  installSource?: string;

  @Expose()
  @IsOptional()
  @IsString()
  installChannel?: string;
}
