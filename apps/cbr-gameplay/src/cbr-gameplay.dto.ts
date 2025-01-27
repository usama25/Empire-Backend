import { PlayerId } from '@lib/fabzen-common/types';
import { Card } from './cbr-gameplay.types';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Expose } from 'class-transformer';

export class JoinTableRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableTypeId: string;
}

export class HandBidRequest {
  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(13)
  hand: number;
}

export class EmojiData {
  @Expose()
  @IsNotEmpty()
  @IsNumber()
  emojiIndex: number;

  @Expose()
  @IsNotEmpty()
  @IsString()
  sender: string;
}

export class MessageData {
  @Expose()
  @IsNotEmpty()
  @IsString()
  message: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  sender: string;
}

export class ThrowCardRequest {
  @Expose()
  @IsNotEmpty()
  @IsEnum(Card)
  card: Card;
}

export class EmojiDataDto {
  @Expose()
  @IsNotEmpty()
  @IsEnum(PlayerId)
  sender: PlayerId;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  emojiIndex: number;
}

export class MessageDataDto {
  @Expose()
  @IsNotEmpty()
  @IsEnum(PlayerId)
  sender: PlayerId;

  @Expose()
  @IsNotEmpty()
  @IsString()
  message: string;
}
