import { PlayerId } from '@lib/fabzen-common/types';
import { CanMovePawn, GameAction, PawnPosition } from '../entities/types';

export type ReconnectionData = {
  isReconnected: boolean;
  status: GameStatus;
  action?: GameAction;
  dices?: Array<number>;
  timeout?: string;
  canMovePawns?: Array<CanMovePawn>;
  score?: number;
  tableInfo?: any;
  tournamentData?: any;
  gameResult?: EndGameEvent;
};

export enum GameStatus {
  started = 'started',
  completed = 'completed',
}

export type GameTimerOption = {
  tableId: string;
  action: GameAction;
  targetCounter: number;
  delayInSeconds?: number;
};

export type GameStartInfo = {
  tableId: string;
  pawnPositions: PawnPosition[];
  myPlayerId: PlayerId;
  totalMoves: number;
  lives: number;
  homeBonus: number;
};

export type MovePawnResponseEvent = {
  tableId: string;
  movedPawns: PawnPosition[];
  score: number;
  bonus: number;
  totalBonus: number;
  turnScore: number;
  gotExtraMove: boolean;
};

export type NextActionEvent = {
  tableId: string;
  action: GameAction;
  canMovePawns?: Array<CanMovePawn>;
  timeout: string;
  lives: number;
  remainingMoves: number;
  isNewTurn: boolean;
};

export type EndGameEvent = {
  tableId: string;
  score: number;
  highestScore: number;
  entriesLeft: number;
  rank: number;
};

export type RemainingMovesEvent = {
  tableId: string;
  bonus: number;
  remainingMoves: number;
};

export type GameEvent = {
  eventName: string;
  eventPayload: any;
};

export type FinishedGameInfo = {
  tournamentId: string;
  score: number;
};

export type TournamentCanceledEvent = {
  userIds: string[];
  tournamentId: string;
  tournamentName: string;
  reason: string;
};
