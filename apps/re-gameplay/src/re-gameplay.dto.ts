import { PlayerId } from '@lib/fabzen-common/types';
import { ReCardsGroup } from './re-gameplay.types';
import { Expose } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class JoinTableRequest {
  @Expose()
  @IsNotEmpty()
  tableTypeId: string;
}

export class DrawRequest {
  @Expose()
  @IsNotEmpty()
  card: string;
}

export class DiscardRequest {
  @Expose()
  @IsNotEmpty()
  card: string;
}

export class GroupRequest {
  @Expose()
  @IsNotEmpty()
  cardsGroups: ReCardsGroup[];
}

export class FlushTableRequest {
  @Expose()
  @IsNotEmpty()
  tableId: string;
}

export class DeclareRequest {
  @Expose()
  @IsNotEmpty()
  card: string;

  @Expose()
  @IsNotEmpty()
  cardsGroups: ReCardsGroup[];
}

export class FinishDeclarationRequest {
  @Expose()
  @IsNotEmpty()
  cardsGroups: ReCardsGroup[];
}

export class RaiseMessage {
  @Expose()
  @IsNotEmpty()
  @IsString()
  amount: string;
}

export class RebuyMessage {
  @Expose()
  @IsNotEmpty()
  @IsString()
  amount: string;
}

export class SideShowResponse {
  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  accepted: boolean;
}

export class EmojiData {
  @Expose()
  @IsNotEmpty()
  sender: string;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  emojiIndex: number;
}

export class MessageData {
  @Expose()
  @IsNotEmpty()
  sender: PlayerId;

  @Expose()
  @IsNotEmpty()
  @IsString()
  message: string;
}
