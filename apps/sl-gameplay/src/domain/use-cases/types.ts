import { UserGameDetails } from '@lib/fabzen-common/types';
import { GameAction, PawnId, Position, PlayerId } from '../entities/types';

export type WaitingInfo = {
  userDetails: UserGameDetails;
  expiry: number;
};

export type NextActionEvent = {
  tableId: string;
  playerId: PlayerId | undefined;
  action: GameAction;
  canMovePawns?: string[];
  turnTimeout: string;
};

export type MovePawnEvent = {
  tableId: string;
  playerId: PlayerId | undefined;
  pawnId: PawnId;
  position: Position;
  dice: number;
  score: string;
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

export type RollDiceEvent = {
  tableId: string;
  playerId: PlayerId;
  dice: number;
};
export type EndGameResponse = {
  userId: string;
  response: {
    tableId: string;
    players: EndGameEvent[];
  };
};

export type TurnSkipEvent = {
  userId: string;
  response: {
    playerId: PlayerId;
    lives: number;
  };
};

export type MovePawnResponseEvent = {
  playerId: PlayerId;
  pawnId: PawnId;
  currentPostion: Position;
  targetPostion: Position;
  dice: number;
  score: number[];
};

export type GameTimerOption = {
  tableId: string;
  action: GameAction;
  targetCounter: number;
  delayInSeconds: number;
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
}
