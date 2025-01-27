// Updated types.ts

import { MobileNumber } from './';
import { PlayerId } from 'apps/epl-gameplay/src/domain/entities';
import { Stat } from './';
import { Address } from './';

export enum EPLGameOutCome {
  won = 'won',
  lost = 'lost',
  draw = 'draw', // Added draw as a possible outcome
}

export enum EPLGameTableStatus {
  stuck = 'stuck',
  ongoing = 'ongoing',
  waiting = 'waiting', // Added waiting status
  finished = 'finished', // Added finished status
}

export interface EPLGameWinningPrize {
  minRank: number;
  maxRank: number;
  amount: string;
  percentage: number;
}

export type EPLTableTypeId = string;

export type UserEPLGameInfo = {
  playerId: PlayerId;
  userId: string;
  name?: string;
  username: string;
  ip: string;
  avatar: number;
  rank: number;
  matches: number;
  stats?: Stat;
  isKycVerified: boolean;
  address: Address;
  mobileNumber: MobileNumber;
  lives: number;
  didLeave: boolean;
  score: number;
  role: PlayerRole; // Added role for the current innings
  totalScore: number; // Renamed from score for clarity
  scores: number[]; // Added to track all scores
  wickets: number; // Added to track wickets
};

export type UserEPLGameInfoForLiveApi = {
  playerId: PlayerId;
  userId: string;
  name?: string;
  username: string;
  didLeave: boolean;
};

export type EPLGameTableData = {
  tableId: string;
  joinFee: string;
  status: EPLGameTableStatus;
  players: UserEPLGameInfoForLiveApi[];
  startedAt?: Date;
  updatedAt?: Date;
  innings?: number; // Added to track current innings
  turnNo?: number; // Added to track current turn number
};

// New types and enums for the Hand Cricket game

export enum EPLGameAction {
  bat = 'bat',
  bowl = 'bowl',
}

export enum PlayerRole {
  batsman = 'batsman',
  bowler = 'bowler',
}

export interface EPLGameBoard {
  currentInnings: number;
  currentOver: number;
  currentBall: number;
  scores: {
    [playerId: string]: number;
  };
  wickets: {
    [playerId: string]: number;
  };
}

export interface BallResult {
  batsmanRuns: number;
  bowlerRuns: number;
  isWicket: boolean;
}

export interface GameResult {
  winner: PlayerId | null; // null in case of a draw
  outcomes: {
    [playerId: string]: EPLGameOutCome;
  };
  finalScores: {
    [playerId: string]: number;
  };
}

export interface NextActionEvent {
  tableId: string;
  playerId: PlayerId | undefined;
  action: EPLGameAction;
  turnTimeout: string;
}

// New interface for game board state
export interface EPLGameBoard {
  currentInnings: number;
  currentOver: number;
  currentBall: number;
  scores: {
    [playerId: string]: number;
  };
  wickets: {
    [playerId: string]: number;
  };
}

// New interface for ball result
export interface BallResult {
  batsmanRuns: number;
  bowlerRuns: number;
  isWicket: boolean;
}

// New interface for game result
export interface GameResult {
  winner: PlayerId | null; // null in case of a draw
  outcomes: {
    [playerId: string]: EPLGameOutCome;
  };
  finalScores: {
    [playerId: string]: number;
  };
}

// New interface for next action event
export interface NextActionEvent {
  tableId: string;
  playerId: PlayerId | undefined;
  action: EPLGameAction;
  turnTimeout: string;
}
