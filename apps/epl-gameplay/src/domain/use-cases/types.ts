import { UserGameDetails } from '@lib/fabzen-common/types';
import { PlayerId } from '../entities/types';

export type WaitingInfo = {
  userDetails: UserGameDetails;
  expiry: number;
};

export type TurnTimeoutEvent = {
  userId: string;
  tableId: string;
  timeout: string;
  playerRole: EPLPlayerRole;
};

export type PlayerInfo = {
  playerId: PlayerId;
  runs: number;
  role: string;
  score: string;
};

// Define the type for the turn result event
export type TurnResultEvent = {
  userId: string;
  turnNo: number;
  isOut: boolean;
  players: PlayerInfo[];
};
export type NextActionEvent = {
  tableId: string;
  playerId: PlayerId | undefined;
  action: EPLGameAction;
  canMovePawns?: string[];
  turnTimeout: string;
};

export type StartGameEvent = {
  userId: string;
  response: {
    tableId: string;
    joinFee: string;
    myPlayerId: PlayerId;
    winAmount: string;
    startGameTimeOut: string;
    gameDurationTimeout: string;
  };
};

export type EndGameResponse = {
  tableId: string;
  players: EndGameEvent[];
};

export type TurnSkipEvent = {
  userId: string;
  response: {
    playerId: PlayerId;
    lives: number;
  };
};

export type GameTimerOption = {
  tableId: string;
  action: EPLGameAction;
  delayInSeconds?: number;
  // targetCounter?: number;
};

export type EndGameEvent = {
  playerId: PlayerId;
  name: string;
  avatar: number;
  totalScore: string;
  winAmount: string;
  isWinner: boolean;
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
  status?: GameStatus;
  game?: string;
  tableType?: any;
  joinTableRes?: any;
  startGameRes?: any;
  setOngoingBoard?: any;
  nextTurnRes?: any;
  movePawnRes?: any;
  gameEndedRes?: any;
  tableInfo?: any;
};

export enum GameStatus {
  waiting = 'waiting',
  started = 'started',
  ongoing = 'ongoing',
  completed = 'completed',
  finished = 'finished',
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

export type UserEPLGameInfo = UserGameDetails & {
  playerId: PlayerId;
  role: EPLPlayerRole;
  runs: number;
  totalScore: number;
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

export enum EPLGameAction {
  bat = 'bat',
  bowl = 'bowl',
  endGame = 'endGame',
  next = 'next',
  skipTurn = 'skipTurn',
  turnTimeout = 'turnTimeout',
  turnResult = 'turnResult',
  inningStart = 'inningStart',
  inningEnd = 'inningEnd',
  gameEnded = 'gameEnded',
}

export type InningStartEvent = {
  userId: string;
  response: {
    tableId: string;
    joinFee: string;
    winAmount: string;
    startGameTimeout: string;
    innings: number;
  };
};
