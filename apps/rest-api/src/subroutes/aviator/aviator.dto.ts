import { Expose } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsObject, IsString } from 'class-validator';

export class AviatorRoundHistoryDto {
  @Expose()
  @IsNotEmpty()
  @IsNumber()
  roundNo: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  crashValue: number;

  @Expose()
  @IsNotEmpty()
  @IsString()
  serverSeed: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  playerSeed1: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  playerSeed2: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  playerSeed3: string;

  @Expose()
  @IsObject()
  playerProfile?: object;
}

export class AviatorUserHistoryDto {
  @Expose()
  @IsNotEmpty()
  @IsNumber()
  betAmount: number;

  @Expose()
  @IsNotEmpty()
  createdAt: Date;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  cashoutAmount: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  multiplierValue: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  roundNo: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  crashValue: number;
}
