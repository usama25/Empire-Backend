import { TableID } from '@lib/fabzen-common/types';
import { Expose } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PawnId, PlayerId, TournamentID } from './ludo-gameplay.types';

export class ForceReconnectRequest {
  @Expose()
  @IsOptional()
  @IsString()
  tableId?: TableID;
}

export class ForceReconnectTournamentRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tournamentId: TournamentID;
}

export class EmojiData {
  @Expose()
  @IsOptional()
  @IsString()
  tableId?: TableID;

  @Expose()
  @IsNotEmpty()
  @IsEnum(PlayerId)
  sender: PlayerId;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  emojiIndex: number;
}

export class MessageData {
  @Expose()
  @IsOptional()
  @IsString()
  tableId?: TableID;

  @Expose()
  @IsNotEmpty()
  @IsEnum(PlayerId)
  sender: PlayerId;

  @Expose()
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class JoinTableRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableTypeId: string;
}

export class CheckIfJoinedRequest {
  @Expose()
  @IsOptional()
  @IsString()
  tableId?: TableID;
}

export class ReadyToStartRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: TableID;
}

export class RollDiceRequest {
  @Expose()
  @IsOptional()
  @IsString()
  tableId?: TableID;
}

export class GetLastGameEventRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: TableID;
}

export class SkipTurnRequest {
  @Expose()
  @IsOptional()
  @IsString()
  tableId?: TableID;
}

export class LeaveTableRequest {
  @Expose()
  @IsOptional()
  @IsString()
  tableId?: TableID;
}

export class IgnoreTournamentRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tournamentId: TournamentID;
}

export class ChangeTableRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: TableID;
}

export class GetLeftPlayerListRequest {
  @Expose()
  @IsOptional()
  @IsString()
  tableId?: TableID;
}

export class MovePawnRequest {
  @Expose()
  @IsOptional()
  @IsString()
  tableId: string;

  @Expose()
  @IsNotEmpty()
  @IsEnum(PawnId)
  pawn: PawnId;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(6)
  dice: number;
}
