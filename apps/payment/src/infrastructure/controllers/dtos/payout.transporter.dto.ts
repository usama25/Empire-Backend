import { IsNotEmpty, IsString } from 'class-validator';

import {
  CreatePayoutOrderRequestDto as CreatePayoutOrderHttpRequestDto,
  CreatePayoutOrderResponseDto as CreatePayoutOrderHttpResponseDto,
  ConvertToMainRequestDto as ConvertToMainHttpRequestDto,
} from 'apps/rest-api/src/subroutes/payment/payout/payout.dto';

export class CreatePayoutOrderRequestDto extends CreatePayoutOrderHttpRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CreatePayoutOrderResponseDto extends CreatePayoutOrderHttpResponseDto {}

export class ConvertToMainRequestDto extends ConvertToMainHttpRequestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
