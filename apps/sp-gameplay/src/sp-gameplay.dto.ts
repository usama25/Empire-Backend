import { PlayerId, TableType } from '@lib/fabzen-common/types';
import { Expose } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class JoinTableRequest {
  @Expose()
  @IsNotEmpty()
  tableType: TableType;
}

export class BuyInResponse {
  @Expose()
  @IsNotEmpty()
  tableType: TableType;

  @Expose()
  @IsNotEmpty()
  @IsString()
  amount: string;
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
