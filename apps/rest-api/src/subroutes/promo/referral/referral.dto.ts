import {
  IsString,
  IsNumberString,
  IsNotEmpty,
  IsArray,
  IsObject,
  IsDateString,
} from 'class-validator';
import { Meta } from '@lib/fabzen-common/types';
import { Expose } from 'class-transformer';

export class ReferralHistoryResponseDto {
  @Expose()
  @IsArray()
  history: ReferralHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class ReferralHistoryDto {
  @IsNotEmpty()
  @IsString()
  userName: string;

  @IsNumberString()
  amount: string;

  @IsDateString()
  createdAt: string;
}
