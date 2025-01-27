import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class GetWalletDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class WalletDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;
}
