import {
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsEnum,
  IsObject,
  IsArray,
  IsDateString,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsBoolean,
} from 'class-validator';

import {
  Gateway,
  JuspayCreateOrderSdkPayload,
  PaymentMethod,
  TxnModes,
  TxnStatus,
} from '@lib/fabzen-common/types/payment.types';
import { Meta } from '@lib/fabzen-common/types';
import { Expose, Type } from 'class-transformer';

export class CreateDepositOrderRequestDto {
  @IsNotEmpty()
  @IsNumberString()
  amount: string;

  @IsString()
  @IsOptional()
  paymentMethod: PaymentMethod = PaymentMethod.upi;
}

export class CreateDepositOrderResponseDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  paymentLink: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @Expose()
  @IsNotEmpty()
  @IsEnum(Gateway)
  gateway: Gateway;

  @Expose()
  @IsString()
  @IsOptional()
  paymentSessionId?: string;

  @Expose()
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @Expose()
  @IsOptional()
  sdkPayload?: JuspayCreateOrderSdkPayload;
}

export class GetOrderStatusRequestDto {
  @IsString()
  orderId: string;
}

export class GetOrderStatusResponseDto {
  @Expose()
  @IsString()
  @IsEnum(TxnStatus)
  status: TxnStatus;

  @Expose()
  @IsNumberString()
  amount: string;
}

export class DepositHistoryResponseDto {
  @Expose()
  @IsArray()
  history: DepositHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class DepositHistoryDto {
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
  @IsNotEmpty()
  settledAmount: string;

  @IsString()
  @IsOptional()
  gstReward?: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  conversionReward?: string;
}

class Order {
  @IsString()
  @IsOptional()
  order_id: string;

  @IsString()
  @IsOptional()
  payment_method_type: string;
}

class Content {
  @IsOptional()
  @ValidateNested()
  @Type(() => Order)
  order: Order;
}

export class JuspayDepositWebhookDto {
  @IsString()
  @IsOptional()
  date_created: string;

  @IsString()
  @IsOptional()
  event_name: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => Content)
  content: Content;
}

export class CashfreeDepositWebhookDto {
  @IsString()
  @IsOptional()
  orderId: string;

  @IsString()
  @IsOptional()
  orderAmount: string;

  @IsString()
  @IsOptional()
  referenceId: string;

  @IsString()
  @IsOptional()
  txStatus: string;

  @IsString()
  @IsOptional()
  paymentMode: string;

  @IsString()
  @IsOptional()
  txMsg: string;

  @IsString()
  @IsOptional()
  txTime: string;

  @IsString()
  @IsOptional()
  signature: string;
}

export class ConversionRateResponseDto {
  @Expose()
  @IsNumber()
  @IsNotEmpty()
  conversionRate: number;

  @Expose()
  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  currencySymbol: string;
}

export class GenerateInvoiceRequest {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsBoolean()
  @IsOptional()
  overwrite: boolean = false;
}
