import { Types } from 'mongoose';
import { DWM, GameOutcome, Games } from '@lib/fabzen-common/types';

export interface CbrPlayer {
  userId: Types.ObjectId;
  winLoseAmount: string;
  outcome: GameOutcome;
  active: boolean;
  playerId: string;
  username: string;
  name?: string;
  avatar: number;
  totalScore: string;
  scores: string[];
}

export interface CbrHistoryDto {
  tableId: string;
  joinFee: string;
  totalRounds: number;
  players: CbrPlayer[];
  startedAt: Date;
}

export interface ScoreboardRequest {
  userId: string;
  tableId: string;
}

export interface LeaderboardRequest {
  skip: number;
  limit: number;
  game: Games;
  dwm: DWM;
  userId: string;
}
