import {
  IsString,
  IsNumberString,
  IsNotEmpty,
  IsArray,
  IsObject,
  IsDateString,
  IsBoolean,
  IsNumber,
  IsDate,
  IsOptional,
} from 'class-validator';
import { Meta, GameOutcome, TableType } from '@lib/fabzen-common/types';
import { Expose } from 'class-transformer';
import { GameTypes } from 'apps/ludo-gameplay/src/ludo-gameplay.types';
import {
  ReRoundHistoryDocument,
  SpRoundHistoryDocument,
} from '@lib/fabzen-common/mongoose/models';
import { ReTableType } from 'apps/re-gameplay/src/re-gameplay.types';

export class CbrHistoryResponseDto {
  @Expose()
  @IsArray()
  history: CbrGameHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class SLGameHistoryResponseDto {
  @Expose()
  @IsArray()
  history: SLGameHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class SLRoundHistoryResponseDto {
  @Expose()
  @IsArray()
  history: SLRoundGameHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class SLRoundGameHistoryDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  tableId: string;

  @IsNumberString()
  @IsNotEmpty()
  joinFee: string;

  @IsNumberString()
  @IsNotEmpty()
  roomSize: number;

  @IsNumber()
  @IsNotEmpty()
  winLoseAmount: string;

  @IsString()
  @IsNotEmpty()
  outcome: GameOutcome;

  @IsString()
  @IsNotEmpty()
  totalScore: string;

  @IsString()
  startedAt: Date;

  @IsDateString()
  @IsNotEmpty()
  createdAt: Date;
}

export class SLGameHistoryDto {
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @IsNumberString()
  @IsNotEmpty()
  joinFee: string;

  @IsNumberString()
  @IsNotEmpty()
  roomSize: number;

  @IsNumber()
  @IsNotEmpty()
  winLoseAmount: string;

  @IsString()
  @IsNotEmpty()
  outcome: GameOutcome;

  @IsString()
  @IsNotEmpty()
  totalScore: string;

  @IsString()
  startedAt: Date;

  @IsDateString()
  @IsNotEmpty()
  createdAt: Date;
}

export class CbrGameHistoryDto {
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @IsNumberString()
  @IsNotEmpty()
  joinFee: string;

  @IsNumber()
  @IsNotEmpty()
  winLoseAmount: number;

  @IsString()
  @IsNotEmpty()
  outcome: GameOutcome;

  @IsBoolean()
  @IsNotEmpty()
  active: boolean;

  @IsString()
  startedAt: Date;

  @IsDateString()
  @IsNotEmpty()
  endedAt: Date;
}

export class SpTableHistoryResponseDto {
  @Expose()
  @IsArray()
  history: SpTableHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class SpTableHistoryDto {
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @IsObject()
  @IsNotEmpty()
  tableType: TableType;

  @IsNumberString()
  @IsNotEmpty()
  startAmount: string;

  @IsNumberString()
  @IsNotEmpty()
  endAmount: string;

  @IsNotEmpty()
  createdAt: Date;
}

export class SpRoundHistoryResponseDto {
  @Expose()
  @IsArray()
  items: SpRoundHistoryDocument[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class ReRoundHistoryResponseDto {
  @Expose()
  @IsArray()
  items: ReRoundHistoryDocument[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class ReTableHistoryResponseDto {
  @Expose()
  @IsArray()
  history: ReTableHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class ReTableHistoryDto {
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @IsObject()
  @IsNotEmpty()
  tableType: ReTableType;

  @IsNumberString()
  @IsNotEmpty()
  startAmount: string;

  @IsNumberString()
  @IsNotEmpty()
  endAmount: string;

  @IsNotEmpty()
  createdAt: Date;
}

export class LudoHistoryResponseDto {
  @Expose()
  @IsArray()
  history: LudoHistoryDto[];

  @Expose()
  @IsObject()
  meta: Meta;
}

export class LudoHistoryDto {
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @IsNumberString()
  @IsNotEmpty()
  joinFee: string;

  @IsString()
  @IsNotEmpty()
  gameType: GameTypes;

  @IsNumber()
  @IsNotEmpty()
  winLoseAmount: number;

  @IsNumber()
  @IsNotEmpty()
  roomSize: number;

  @IsString()
  @IsNotEmpty()
  outcome: GameOutcome;

  @IsNotEmpty()
  @IsDate()
  createdAt: Date;
}

export class ScoreboardResponseDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  tableId: string;

  @Expose()
  @IsNumberString()
  @IsNotEmpty()
  joinFee: string;

  @Expose()
  @IsOptional()
  @IsString()
  startedAt: Date;

  @Expose()
  @IsNotEmpty()
  endedAt: Date;

  @Expose()
  @IsArray()
  scoreboard: CbrPlayer[];
}

export class CbrPlayer {
  @IsString()
  @IsNotEmpty()
  playerId: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumberString()
  @IsNotEmpty()
  totalScore: string;

  @IsBoolean()
  active: boolean;

  @IsNotEmpty()
  @IsNumber()
  avatar: number;

  @IsArray()
  scores: string[];
}

export class LeaderboardItemDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsNumber()
  @IsNotEmpty()
  avatar: number;

  @IsNumber()
  @IsNotEmpty()
  rank: number;

  @IsNumber()
  @IsNotEmpty()
  playedGames: number;

  @IsNumber()
  @IsString()
  winAmount: string;
}

export class LeaderboardResponseDto {
  @Expose()
  @IsArray()
  history: LeaderboardItemDto[];

  @Expose()
  @IsObject()
  meta: Meta;

  @Expose()
  @IsObject()
  myPlayer: LeaderboardItemDto;
}

export class LudoMegaTournamentHistoryDto {
  @IsString()
  @IsNotEmpty()
  tournamentId: string;

  @IsString()
  @IsNotEmpty()
  tournamentName: string;

  @IsNumberString()
  @IsNotEmpty()
  joinFee: string;

  @IsNumberString()
  @IsNotEmpty()
  winAmount: string;

  @IsNumberString()
  @IsNotEmpty()
  score: string;

  @IsNumber()
  @IsNotEmpty()
  entryNo: number;

  @IsDateString()
  @IsNotEmpty()
  endAt: Date;
}
