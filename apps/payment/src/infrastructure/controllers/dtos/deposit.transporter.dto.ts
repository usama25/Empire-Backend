import { IsNotEmpty, IsString } from 'class-validator';

import {
  CreateDepositOrderRequestDto as CreateDepositOrderHttpRequestDto,
  CreateDepositOrderResponseDto as CreateDepositOrderHttpResponseDto,
  GetOrderStatusRequestDto as GetOrderStatusHttpRequestDto,
  GetOrderStatusResponseDto as GetOrderStatusHttpResponseDto,
} from 'apps/rest-api/src/subroutes/payment/deposit/deposit.dto';

export class CreateDepositOrderRequestDto extends CreateDepositOrderHttpRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CreateDepositOrderResponseDto extends CreateDepositOrderHttpResponseDto {}

export class GetOrderStatusRequestDto extends GetOrderStatusHttpRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class GetOrderStatusResponseDto extends GetOrderStatusHttpResponseDto {}
