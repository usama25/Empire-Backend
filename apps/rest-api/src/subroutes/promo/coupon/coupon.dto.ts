import { BonusType, WalletTypes } from '@lib/fabzen-common/types';
import { IsString, IsNotEmpty, IsBoolean, IsDateString } from 'class-validator';

export class GetCouponDto {
  @IsNotEmpty()
  @IsString()
  promoCode: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  minAmount: string;

  @IsNotEmpty()
  @IsString()
  maxAmount: string;

  @IsNotEmpty()
  @IsString()
  expireAt: Date;

  @IsNotEmpty()
  @IsString()
  bonusAmount: string;

  @IsNotEmpty()
  @IsString()
  bonusType: BonusType;

  @IsNotEmpty()
  @IsString()
  wallet: WalletTypes;

  @IsBoolean()
  isDeleted: boolean;
}

export class CreateCouponDto {
  @IsNotEmpty()
  @IsString()
  promoCode: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  minAmount: string;

  @IsNotEmpty()
  @IsString()
  maxAmount: string;

  @IsNotEmpty()
  @IsDateString()
  expireAt: Date;

  @IsNotEmpty()
  @IsString()
  bonusAmount: string;

  @IsNotEmpty()
  @IsString()
  bonusType: BonusType;

  @IsNotEmpty()
  @IsString()
  wallet: WalletTypes;

  @IsBoolean()
  isDeleted: boolean;
}

export class GetCouponByPromoCodeDto {
  @IsNotEmpty()
  @IsString()
  promoCode: string;
}
