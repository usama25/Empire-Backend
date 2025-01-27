// types.ts

import { UserGameDetails } from '@lib/fabzen-common/types';

// Define PlayerId directly in this file
export type PlayerId = `PL${number}`;

export enum EPLGameAction {
  bat = 'bat',
  bowl = 'bowl',
  endGame = 'endGame',
  next = 'next',
  turnTimeout = 'turnTimeout',
  turnResult = 'turnResult',
  inningStart = 'inningStart',
  inningEnd = 'inningEnd',
  gameEnded = 'gameEnded',
}

export enum EPLPlayerRole {
  batsman = 'batsman',
  bowler = 'bowler',
}

export enum EPLGameTableStatus {
  waiting = 'waiting',
  started = 'started',
  ongoing = 'ongoing',
  completed = 'completed',
  finished = 'finished',
}

export type WaitingInfo = {
  userDetails: UserGameDetails;
  expiry: number;
};

export type UserEPLGameInfo = UserGameDetails & {
  playerId: PlayerId;
  role: EPLPlayerRole;
  runs: number;
  score: string;
  scores: number[];
  wickets: number;
  didLeave: boolean;
};

export type EPLGameBoard = {
  currentInnings: number;
  currentBall: number;
  scores: {
    [playerId: string]: number;
  };
  wickets: {
    [playerId: string]: number;
  };
};

export type NextActionEvent = {
  tableId: string;
  playerId: PlayerId | undefined;
  action: EPLGameAction;
  turnTimeout: string;
};

export type StartGameEvent = {
  userId: string;
  response: {
    tableId: string;
    joinFee: string;
    myPlayerId: PlayerId;
    myRole: EPLPlayerRole;
    winAmount: string;
    startGameTimeOut: string;
    gameDurationTimeout: string;
  };
};

export type EndGameResponse = {
  tableId: string;
  players: EndGameEvent[];
};

export type EndGameEvent = {
  playerId: PlayerId;
  name: string;
  avatar: number;
  totalScore: string;
  winAmount: string;
  isWinner: boolean;
};

export type TurnSkipEvent = {
  userId: string;
  response: {
    playerId: PlayerId;
    runs: number;
  };
};

export type GameTimerOption = {
  tableId: string;
  action: EPLGameAction;
  targetCounter: number;
  delayInSeconds?: number;
};

export type LeftTableEvent = {
  userId: string;
  response: {
    tableId: string;
    playerId: string;
  };
};

export type LeaveWaitingTableEvent = {
  userId: string;
  leaveWaitingTableResponse: {
    status: boolean;
    leftPlayerId: PlayerId;
    oldMyPlayerId: PlayerId;
    newMyPlayerId: PlayerId;
  };
};

export type ReconnectionData = {
  isReconnected: boolean;
  status?: EPLGameTableStatus;
  game?: string;
  tableType?: any;
  joinTableRes?: any;
  startGameRes?: any;
  setOngoingBoard?: any;
  nextTurnRes?: any;
  gameEndedRes?: any;
  tableInfo?: any;
};

export type BallResult = {
  batsmanRuns: number;
  bowlerRuns: number;
  isWicket: boolean;
};

export type GameResult = {
  winner: PlayerId | null; // null in case of a draw
  outcomes: {
    [playerId: string]: 'won' | 'lost' | 'draw';
  };
  finalScores: {
    [playerId: string]: number;
  };
};
