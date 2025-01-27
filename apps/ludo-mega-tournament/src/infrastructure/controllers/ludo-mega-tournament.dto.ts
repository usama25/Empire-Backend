import { Expose } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PawnId } from '../../domain/entities';

export class PlayRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tournamentId: string;
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

export class MovePawnRequest {
  @Expose()
  @IsNotEmpty()
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

export class SkipTurnRequest {
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

export class GetLastGameEventRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: string;
}

export class ForceReconnectRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: string;
}
