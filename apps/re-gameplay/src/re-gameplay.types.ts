import { GameOutcome, UserGameDetails } from '@lib/fabzen-common/types';
import { Types } from 'mongoose';

export interface ReTable {
  tableId: string;
  roundId: string;
  dealerId: RePlayerId;
  myPlayerId?: RePlayerId;
  currentTurn: string;
  joinNo: number;
  variation: string;
  maxPlayer: string;
  gameOption: ReGameOption;
  gameStatus: ReGameStatus;
  serverTime: string;
  turnNo: number;
  timeout: string;
  wildCard?: string;
  declareCard?: string;
  closedDeckCards: string[];
  openDeckCards: string[];
  tableType: ReTableType;
  players: PlayerInfo[];
  leftPlayers: PlayerInfo[];
  firstDeclaredPlayer?: RePlayerId;
  droppedScore: string;
  commissionAmount: string;
  declaredNo: number;
  locked?: boolean;
  roundStartedAt?: string;
  createdAt: string;
  updatedAt: string;
  isMaintenanceBypass: boolean;
}

export type ReTableId = string;

export const DefaultGroupNumber: number = 4;

export const NumberOfCardsPerPlayer: number = 13;

export const MaxCardsPerGroup: number = 6;

export const MaxScore: number = 80;

export interface RePlayerInfo {
  playerId: RePlayerId;
  userId: string;
  walletBalance?: SubWallet;
}

export interface ReGameEndInfo {
  winner: string;
  winningAmount: string;
  commissionAmount: string;
  table: ReTable;
  tableType: ReTableType;
}

export enum GameOption {
  practice = 'PRACTICE',
  realmoney = 'REALMONEY',
  tournament = 'TOURNAMENT',
}

export enum ReGameStatus {
  waiting = 'waiting',
  roundStarted = 'roundStarted',
  dealCards = 'dealCards',
  drawCard = 'drawCard',
  discardCard = 'discardCard',
  declareCards = 'declareCards',
  groupCards = 'groupCards',
  playing = 'playing',
  roundEnded = 'roundEnded',
  gameEnded = 'gameEnded',
}

export enum ReGameOutcome {
  won = 'won',
  lost = 'lost',
}

export type ReStartGameParameters = {
  users: UserQueueData[];
  tableType: ReTableType;
};

export type ReRoundHistoryDto = {
  tableId: string;
  tableType: ReTableType;
  joinFee: string;
  roundId: string;
  commissionAmount?: string;
  winner: string;
  wildCard: string;
  userInfo: ReUserInfo[];
  roundStartedAt?: string;
};

export type ReTableHistoryDto = {
  userId: Types.ObjectId;
  tableId: string;
  joinFee: string;
  startAmount: string;
  endAmount: string;
  tableReType: ReTableType;
};

export interface ReUserInfo {
  userId: Types.ObjectId;
  username: string;
  winLossAmount: string;
  handCards: ReCardsGroup[];
  status: Status;
  score: string;
  avatar: number;
  outcome: GameOutcome;
}

export interface ReTableType {
  tableTypeId: string;
  variation: string;
  pointValue: string;
  maxPlayer: string;
  matchingTime: number;
}

export enum ReGameType {
  multiplayer = '6',
  twoplayer = '2',
}

export enum ReGameOption {
  practice = 'practice',
  realmoneny = 'realmoney',
  tournament = 'tournament',
}

export interface ReWaitingInfo {
  tableType: ReTableType;
  timeout: string;
}

export interface SubWallet {
  main: string | Big;
  bonus: string | Big;
  winning: string | Big;
}

export enum RePlayerId {
  pl1 = 'PL1',
  pl2 = 'PL2',
  pl3 = 'PL3',
  pl4 = 'PL4',
  pl5 = 'PL5',
  pl6 = 'PL6',
}

export enum Status {
  active = 'active',
  drop = 'drop',
  leave = 'leave',
  waiting = 'waiting',
}

export interface PlayerInfo {
  playerId: RePlayerId;
  userId: string;
  cardsGroups?: ReCardsGroup[];
  cards?: string[];
  active: boolean;
  isDrawn: boolean;
  isDiscarded: boolean;
  isFirstDeclared: boolean;
  declare: boolean;
  isDecValid: boolean;
  turnNo: number;
  drop: boolean;
  softDrop: boolean;
  late: boolean;
  score: string;
  startAmount: string;
  playerInfo: UserGameDetails;
}

export interface PlayerGameInfo {
  playerId: RePlayerId;
  userId: string;
  walletBalance: SubWallet;
  playerInfo: UserGameDetails;
}

export interface ReCardsGroup {
  cards: string[];
  groupState: ReGroupState | undefined;
  valid: boolean;
}

export enum ReGroupState {
  pureSequence = 'PURE-SEQUENCE',
  impureSequence = 'IMPURE-SEQUENCE',
  set = 'SET',
  heart = 'HEART',
  spade = 'SPADE',
  diamond = 'DIAMOND',
  club = 'CLUB',
  joker = 'JOKER',
}

export type GameTablePlayers = {
  playerId: RePlayerId;
  userId: string;
  username: string;
};

export type GameTableData = {
  tableId: string;
  tableType: ReTableType;
  players: GameTablePlayers[];
  roundId: string;
  gameStatus: ReGameStatus;
  updatedAt: string;
};

export const DefautGroupSuit = ['Heart', 'SPADE', 'DIAMOND', 'CLUB'];

export interface ReDealCardsResponse {
  tableId: string;
  gameStatus: ReGameStatus;
  cardsGroups?: ReCardsGroup[];
  wildCard?: string;
  closeDeckCards?: string[];
  timeout: string;
}

export interface ReDeclarationResult {
  isValid: boolean;
  player: PlayerInfo;
}

export type UserQueueData = {
  userId: UserID;
  amount: SubWallet;
  expiry: number;
  walletBalance: SubWallet;
  isMaintenanceBypass: boolean;
};

export type UserID = string;

export type StartGameParameters = {
  users: UserQueueData[];
  tableType: ReTableType;
};

export interface ReWaitingInfo {
  tableType: ReTableType;
  timeout: string;
}

export interface ReTableWithPid {
  table: ReTable;
  pid: string;
}

export enum GameAction {
  startRound = 'startRound',
  startPlaying = 'startPlaying',
  dropPlayer = 'dropPlayer',
  dealCards = 'dealCards',
  finishDeclaration = 'finishDeclaration',
  roundEnded = 'roundEnded',
  endGame = 'endGame',
  next = 'next',
}

export enum ReCard {
  cd1 = 'H,2',
  cd2 = 'H,3',
  cd3 = 'H,4',
  cd4 = 'H,5',
  cd5 = 'H,6',
  cd6 = 'H,7',
  cd7 = 'H,8',
  cd8 = 'H,9',
  cd9 = 'H,10',
  cd10 = 'H,11',
  cd11 = 'H,12',
  cd12 = 'H,13',
  cd13 = 'H,14',
  cd14 = 'S,2',
  cd15 = 'S,3',
  cd16 = 'S,4',
  cd17 = 'S,5',
  cd18 = 'S,6',
  cd19 = 'S,7',
  cd20 = 'S,8',
  cd21 = 'S,9',
  cd22 = 'S,10',
  cd23 = 'S,11',
  cd24 = 'S,12',
  cd25 = 'S,13',
  cd26 = 'S,14',
  cd27 = 'D,2',
  cd28 = 'D,3',
  cd29 = 'D,4',
  cd30 = 'D,5',
  cd31 = 'D,6',
  cd32 = 'D,7',
  cd33 = 'D,8',
  cd34 = 'D,9',
  cd35 = 'D,10',
  cd36 = 'D,11',
  cd37 = 'D,12',
  cd38 = 'D,13',
  cd39 = 'D,14',
  cd40 = 'C,2',
  cd41 = 'C,3',
  cd42 = 'C,4',
  cd43 = 'C,5',
  cd44 = 'C,6',
  cd45 = 'C,7',
  cd46 = 'C,8',
  cd47 = 'C,9',
  cd48 = 'C,10',
  cd49 = 'C,11',
  cd50 = 'C,12',
  cd51 = 'C,13',
  cd52 = 'C,14',
  cdRedJoker = 'S,0',
  cdBlackJoker = 'D,0',
}

export const ReCardsDeck = [
  'D1,H,2',
  'D1,H,3',
  'D1,H,4',
  'D1,H,5',
  'D1,H,6',
  'D1,H,7',
  'D1,H,8',
  'D1,H,9',
  'D1,H,10',
  'D1,H,11',
  'D1,H,12',
  'D1,H,13',
  'D1,H,14',
  'D1,S,2',
  'D1,S,3',
  'D1,S,4',
  'D1,S,5',
  'D1,S,6',
  'D1,S,7',
  'D1,S,8',
  'D1,S,9',
  'D1,S,10',
  'D1,S,11',
  'D1,S,12',
  'D1,S,13',
  'D1,S,14',
  'D1,D,2',
  'D1,D,3',
  'D1,D,4',
  'D1,D,5',
  'D1,D,6',
  'D1,D,7',
  'D1,D,8',
  'D1,D,9',
  'D1,D,10',
  'D1,D,11',
  'D1,D,12',
  'D1,D,13',
  'D1,D,14',
  'D1,C,2',
  'D1,C,3',
  'D1,C,4',
  'D1,C,5',
  'D1,C,6',
  'D1,C,7',
  'D1,C,8',
  'D1,C,9',
  'D1,C,10',
  'D1,C,11',
  'D1,C,12',
  'D1,C,13',
  'D1,C,14',
  'D2,H,2',
  'D2,H,3',
  'D2,H,4',
  'D2,H,5',
  'D2,H,6',
  'D2,H,7',
  'D2,H,8',
  'D2,H,9',
  'D2,H,10',
  'D2,H,11',
  'D2,H,12',
  'D2,H,13',
  'D2,H,14',
  'D1,S,0',
  'D2,D,0',
  'D2,S,2',
  'D2,S,3',
  'D2,S,4',
  'D2,S,5',
  'D2,S,6',
  'D2,S,7',
  'D2,S,8',
  'D2,S,9',
  'D2,S,10',
  'D2,S,11',
  'D2,S,12',
  'D2,S,13',
  'D2,S,14',
  'D2,D,2',
  'D2,D,3',
  'D2,D,4',
  'D2,D,5',
  'D2,D,6',
  'D2,D,7',
  'D2,D,8',
  'D2,D,9',
  'D2,D,10',
  'D2,D,11',
  'D2,D,12',
  'D2,D,13',
  'D2,D,14',
  'D2,C,2',
  'D2,C,3',
  'D2,C,4',
  'D2,C,5',
  'D2,C,6',
  'D2,C,7',
  'D2,C,8',
  'D2,C,9',
  'D2,C,10',
  'D2,C,11',
  'D2,C,12',
  'D2,C,13',
  'D2,C,14',
];

export enum ReGameLog {
  leaveTable = 'LeaveTable',
  reconnectGame = 'reconnectGame',
  exception = 'exception',
  joinTable = 'joinTable',
  startRound = 'startRound',
  drawCardRequest = 'drawCardRequest',
  discardCardRequest = 'discardCardRequest',
  drawCardResponse = 'drawCardResponse',
  discardCardResponse = 'discardCardResponse',
  declareRequest = 'declareRequest',
  userDefineGroupRequest = 'userDefineGroupReq',
  userDefineGroupResponse = 'userDefineGroupResponse',
  playerLeftTable = 'playerLeftTable',
  leaveWaitingTable = 'leaveWaitingTable',
  matchingTimeout = 'matchingTimeout',
  checkIfJoined = 'checkIfJoined',
  joinTableResponse = 'joinTableRes',
  gameEnded = 'gameEnded',
  roundEnded = 'roundEnded',
  turnTimeout = 'turnTimeout',
  leaveWaitingTableResponse = 'leaveWaitingTableRes',
  allUserCount = 'allUserCount',
  userCount = 'userCount',
  destroyInactiveTable = 'destroyInactiveTable',
  maintenance = 'maintenance',
}
