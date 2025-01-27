import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { PawnId, PlayerId } from './types';
import { Expose } from 'class-transformer';

export type TableID = string;
export type UserID = string;

export class JoinTableRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableTypeId: string;
}

export class leaveWaitingTableRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableTypeId: string;
}

export class ReadyToStartRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: string;
}

export class RollDiceRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: string;
}

export class LeaveTableRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: string;
}

export class SkipTurnRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: string;
}

export class MovePawnRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: string;

  @Expose()
  @IsNotEmpty()
  @IsEnum(PawnId)
  pawnId: PawnId;
}

export class EmojiData {
  @Expose()
  @IsOptional()
  @IsString()
  sender: PlayerId;

  @Expose()
  @IsOptional()
  @IsNumber()
  emojiIndex: number;
}

export class MessageData {
  @Expose()
  @IsNotEmpty()
  @IsEnum(PlayerId)
  sender: PlayerId;

  @Expose()
  @IsNotEmpty()
  @IsString()
  message: string;
}
