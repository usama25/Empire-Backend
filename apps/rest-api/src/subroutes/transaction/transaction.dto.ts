import {
  IsNumberString,
  IsArray,
  IsObject,
  IsDateString,
  IsNotEmpty,
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import {
  Games,
  Meta,
  TransactionType,
  WalletTypes,
} from '@lib/fabzen-common/types';
import { Expose } from 'class-transformer';

export class BonusHistoryResponseDto {
  @Expose()
  @IsArray()
  history: BonusHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class BonusHistoryDto {
  @IsNotEmpty()
  @IsNumberString()
  amount: string;

  @IsNotEmpty()
  @IsDateString()
  createdAt: string;

  @IsNotEmpty()
  @IsEnum(TransactionType)
  type: TransactionType;
}

export class RefundHistoryResponseDto {
  @Expose()
  @IsArray()
  history: RefundHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class RefundHistoryDto {
  @IsNotEmpty()
  @IsNumberString()
  amount: string;

  @IsNotEmpty()
  @IsDateString()
  createdAt: string;

  @IsNotEmpty()
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNotEmpty()
  @IsString()
  game?: Games;

  @IsString()
  orderType?: string;

  @IsString()
  tournamentId?: string;

  @IsString()
  orderId?: string;

  @IsString()
  tournamentName?: string;
}

export class AdminRefundRequestBody {
  @IsString()
  @IsEnum(WalletTypes)
  wallet: WalletTypes;

  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  amount?: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsOptional()
  game?: Games;

  @IsBoolean()
  credit: boolean;
}
