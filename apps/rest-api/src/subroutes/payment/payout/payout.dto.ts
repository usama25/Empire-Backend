import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import {
  Meta,
  PayoutType,
  TxnStatus,
  TxnModes,
} from '@lib/fabzen-common/types';
import { Expose, Type } from 'class-transformer';

export class CreatePayoutOrderRequestDto {
  @IsNotEmpty()
  @IsNumberString()
  amount: string;

  @IsNotEmpty()
  @IsString()
  payoutType: PayoutType;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

  @IsOptional()
  @IsString()
  upiId?: string;
}

export class CreatePayoutOrderResponseDto {
  @Expose()
  @IsString()
  @IsEnum(TxnStatus)
  status: TxnStatus;

  @Expose()
  @IsString()
  orderId: string;

  @Expose()
  @IsNumberString()
  amount: string;
}

export class PayoutHistoryResponseDto {
  @Expose()
  @IsArray()
  history: PayoutHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

class TaxDeduction {
  @IsString()
  @IsOptional()
  financialYear: string;

  @IsString()
  @IsOptional()
  isTdsDeducted: boolean;

  @IsString()
  @IsOptional()
  tdsAmount: string;
}

export class PayoutHistoryDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(TxnModes)
  mode: TxnModes;

  @IsNumberString()
  amount: string;

  @IsDateString()
  createdAt: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  settledAmount: string;

  @IsString()
  @IsNotEmpty()
  tdsReward: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TaxDeduction)
  taxDeduction?: TaxDeduction;

  @IsOptional()
  @IsEnum(PayoutType)
  payoutType: PayoutType;

  @IsOptional()
  @IsNumberString()
  accountVerificationCharges?: string;
}

export class Order {
  @IsString()
  orderType: string;

  @IsString()
  merchantOrderId: string;

  @IsString()
  merchantCustomerId: string;

  @IsString()
  id: string;

  @IsString()
  status: string;

  @IsDateString()
  updatedAt: string;

  @IsDateString()
  createdAt: string;

  @IsNumber()
  amount: number;
}

export class JuspayPayoutWebhookDto {
  @IsOptional()
  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  label: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => Order)
  info: Order;

  @IsOptional()
  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  id: string;
}

export class CashfreePayoutWebhookDto {
  @IsOptional()
  @IsString()
  event: string;

  @IsOptional()
  @IsString()
  transferId: string;

  @IsOptional()
  @IsString()
  referenceId: string;

  @IsOptional()
  @IsString()
  signature: string;
}

export class TdsDetailsResponse {
  @IsString()
  @Expose()
  paidTds: string;

  @IsString()
  @Expose()
  tdsLiability: string;

  @IsString()
  @Expose()
  financialYear: string;
}

export class ConvertToMainRequestDto {
  @IsNotEmpty()
  @IsNumberString()
  amount: string;
}

export class VerifiedWithdrawalAccountDto {
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifsc?: string;

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;
}
