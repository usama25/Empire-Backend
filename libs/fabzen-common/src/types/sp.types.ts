import { RemoteSocket } from 'socket.io';
import { AuthenticatedUser } from './auth.types';
import { Currency } from './payment.types';
import { UserGameDetails, UserID } from './user.types';
import { EventsMap } from 'socket.io/dist/typed-events';
import { Types } from 'mongoose';

export interface ExtendedSocket extends RemoteSocket<EventsMap, any> {
  user: AuthenticatedUser;
  tableId?: string;
}

export enum GameTypes {
  twoPlayer = 'twoPlayer',
  multiplayer = 'multiplayer',
}

export type BuyInResponse = {
  tableType: TableType;
  amount: string;
  currency: Currency;
};

export interface Table {
  tableId: string;
  tableType: TableType;
  roundNo: number;
  dealerId: PlayerId;
  currentTurn: PlayerId;
  commonCard?: Card;
  hidden: boolean; // common card is hidden or not
  chaalAmount: string;
  gameStatus: GameStatus;
  players: PlayerGameInfo[];
  potAmount: string;
  joinNo: number;
  turnNo: number;
  skipTurnNo: number;
  timeout?: string;
  rebuyTimeout?: string;
  playersAmount?: PlayerAmount[];
  sideshowAccepted?: boolean;
  roundEndInfo?: GameEndInfo;
  locked?: boolean;
  roundStartedAt?: string;
  updated?: string;
  isMaintenanceBypass?: boolean;
  roundStartPlayersNo?: number;
}

export interface TableWithPid {
  table: Table;
  pid: string;
}

export interface PlayerAmount {
  userId: string;
  amount: SubWallet;
}

export interface TableType {
  tableTypeId: string;
  minJoinAmount: string;
  initialBetAmount: string;
  potLimit: string;
  gameType: GameTypes;
}

export interface CheckWalletBalance {
  subWallet: SubWallet;
  walletBalance: SubWallet;
}

export enum NoPlayers {
  two = 2,
  six = 6,
}

export type StartGameParameters = {
  users: UserQueueData[];
  tableType: TableType;
};

export enum GameOutcome {
  won = 'won',
  lost = 'lost',
}

export type SocketID = string;

export enum GameStatus {
  waiting = 'waiting',
  roundStarted = 'roundStarted',
  initialBet = 'initialBet',
  dealCards = 'dealCards',
  playing = 'playing',
  sideshow = 'sideshow',
  showdown = 'showdown',
  roundEnded = 'roundEnded',
  gameEnded = 'gameEnded',
}

export type JoinGameResponse = {
  status: GameStatus;
  tableId: string;
  players: Player[];
};

export interface Player {
  playerId: PlayerId;
  userId: string;
  amount?: SubWallet;
  active?: boolean;
}

export interface PlayerStat {
  won: number;
  lost: number;
}

export interface PlayerDetail {
  playerId: PlayerId;
  userId: string;
  username: string;
  avatar: number;
  walletBalance?: SubWallet;
}

export interface PlayerGameInfo {
  playerId: PlayerId;
  userId: string;
  walletBalance: SubWallet;

  active: boolean; // playing or sitting out
  startAmount: string;
  roundAmount: string;
  amount: SubWallet;
  allin: boolean;
  sidepot: string;
  seen: boolean; // seen the cards or not
  chaalAfterSeen: boolean;
  lastBetAmount: string;
  firstCard?: Card;
  hiddenCards?: [Card, Card];
  betAmount: string;
  rebuying: boolean;
  joinedRoundNo?: number;

  playerInfo: UserGameDetails;
}

export interface SubWallet {
  main: string | Big;
  bonus: string | Big;
  winning: string | Big;
}

export enum PlayerId {
  pl1 = 'PL1',
  pl2 = 'PL2',
  pl3 = 'PL3',
  pl4 = 'PL4',
  pl5 = 'PL5',
  pl6 = 'PL6',
}

export enum Card {
  cd1 = '2H',
  cd2 = '3H',
  cd3 = '4H',
  cd4 = '5H',
  cd5 = '6H',
  cd6 = '7H',
  cd7 = '8H',
  cd8 = '9H',
  cd9 = 'TH',
  cd10 = 'JH',
  cd11 = 'QH',
  cd12 = 'KH',
  cd13 = 'AH',
  cd14 = '2S',
  cd15 = '3S',
  cd16 = '4S',
  cd17 = '5S',
  cd18 = '6S',
  cd19 = '7S',
  cd20 = '8S',
  cd21 = '9S',
  cd22 = 'TS',
  cd23 = 'JS',
  cd24 = 'QS',
  cd25 = 'KS',
  cd26 = 'AS',
  cd27 = '2D',
  cd28 = '3D',
  cd29 = '4D',
  cd30 = '5D',
  cd31 = '6D',
  cd32 = '7D',
  cd33 = '8D',
  cd34 = '9D',
  cd35 = 'TD',
  cd36 = 'JD',
  cd37 = 'QD',
  cd38 = 'KD',
  cd39 = 'AD',
  cd40 = '2C',
  cd41 = '3C',
  cd42 = '4C',
  cd43 = '5C',
  cd44 = '6C',
  cd45 = '7C',
  cd46 = '8C',
  cd47 = '9C',
  cd48 = 'TC',
  cd49 = 'JC',
  cd50 = 'QC',
  cd51 = 'KC',
  cd52 = 'AC',
}

export const CardsDeck = [
  '2H',
  '3H',
  '4H',
  '5H',
  '6H',
  '7H',
  '8H',
  '9H',
  'TH',
  'JH',
  'QH',
  'KH',
  'AH',
  '2S',
  '3S',
  '4S',
  '5S',
  '6S',
  '7S',
  '8S',
  '9S',
  'TS',
  'JS',
  'QS',
  'KS',
  'AS',
  '2D',
  '3D',
  '4D',
  '5D',
  '6D',
  '7D',
  '8D',
  '9D',
  'TD',
  'JD',
  'QD',
  'KD',
  'AD',
  '2C',
  '3C',
  '4C',
  '5C',
  '6C',
  '7C',
  '8C',
  '9C',
  'TC',
  'JC',
  'QC',
  'KC',
  'AC',
];

export enum CardsCategory {
  trail = 'Trail',
  pureSequence = 'Pure Sequence',
  sequence = 'Sequence',
  color = 'Color',
  pair = 'Pair',
  highest = 'High Card',
}

export enum CompareResult {
  win = 'win',
  draw = 'draw',
  lose = 'lose',
}

export enum GameAction {
  chaal = 'chaal',
  raise = 'raise',
  allin = 'allin',
  rebuyTimeoutLeave = 'rebuyTimeoutLeave',
  rebuyBalanceLeave = 'rebuyBalanceLeave',
  startRound = 'startRound',
  startPlaying = 'startPlaying',
  initialBet = 'initialBet',
  dealCards = 'dealCards',
  roundEnded = 'roundEnded',
  sideshow = 'sideshow',
  sideshowAccept = 'sideshowAccept',
  sideshowReject = 'sideshowReject',
  rebuy = 'rebuy',
  pack = 'pack',
  skipTurn = 'skipTurn',
  endGame = 'endGame',
  next = 'next',
}

export interface EndGameResult {
  winner: PlayerInfo;
  winningAmount: string;
}

export interface GameFinishedMessage {
  winner: PlayerId;
  winningAmount: string;
}

export interface RaiseMessage {
  amount: string;
}

export interface RebuyMessage {
  amount: string;
}

export type EmojiData = {
  sender: PlayerId;
  emojiIndex: number;
};

export type SideShowResponse = {
  accepted: boolean;
};

export interface PlayerCardsInfo {
  category: CardsCategory;
  cards: [Card, Card, Card];
}

export type MessageData = {
  sender: PlayerId;
  message: string;
};

export type FlushTableRequest = {
  tableId: TableID;
};

export interface PlayerEndInfo {
  playerId: PlayerId;
  playerCardsInfo?: PlayerCardsInfo;
  handCards?: [Card, Card, Card];
  amount?: string;
  playerAmount: string;
}

export interface GameEndInfo {
  winners: PlayerId[];
  winnerUserIds: string[];
  playersEndInfo: PlayerEndInfo[];
  commissionAmount: string;
}

export interface UserInfo {
  userId: Types.ObjectId;
  username: string;
  winLossAmount: string;
  avatar: number;
  outcome: GameOutcome;
  betAmount: string;
  status: string;
  playerAmount: string;
  playerCardsInfo?: PlayerCardsInfo;
  handCards?: Card[];
}

export interface WinnerCompareInfo {
  commonCard: Card;
  playersInfo: PlayerCards[];
}

export interface PlayerCards {
  playerId: PlayerId;
  cards: [Card, Card, Card];
}

export interface WinnerAmount {
  playerId: PlayerId;
  amount: string;
}

export interface SideShowCardsInfo {
  id: PlayerId;
  playerCardsInfo: PlayerCardsInfo;
}

export interface SideShowInfo {
  winner: PlayerId | '';
  info: SideShowCardsInfo[];
}

export interface PlayerInfo {
  userId: string;
  winLossAmount: string;
  betAmount: string;
  playerEndInfo: PlayerEndInfo;
}

export interface WaitingTable {
  [key: string]: PlayerId | string;
}

export interface WaitingInfo {
  tableType: TableType;
  timeout: string;
}

export interface NextAction {
  player: PlayerId;
  action: GameAction;
  timeout: string; // ISO Date
}

export interface UserState {
  tableId?: string;
  clientId?: string;
}

export type TableID = string;

export enum GameLog {
  chaal = 'Chaal',
  raise = 'Raise',
  sideshowStart = 'SideshowStart',
  sideshowAccepted = 'SideshowAccepted',
  sideshowRejected = 'SideshowRejected',
  see = 'See',
  allin = 'Allin',
  pack = 'Pack',
  leaveTable = 'LeaveTable',
  rebuy = 'Rebuy',
  showdown = 'Showdown',
  reconnectGame = 'reconnectGame',
  exception = 'exception',
  joinTable = 'joinTable',
  buyInRequest = 'buyInReq',
  startRound = 'startRound',
  initialBet = 'initialBet',
  dealCards = 'dealCards',
  sideshowResult = 'sideshowResult',
  playerLeftTable = 'playerLeftTable',
  leaveWaitingTable = 'leaveWaitingTable',
  buyInResponse = 'buyInRes',
  matchingTimeout = 'matchingTimeout',
  checkIfJoined = 'checkIfJoined',
  rebuyResponse = 'rebuyRes',
  sideshowResponse = 'sideshowRes',
  joinTableResponse = 'joinTableRes',
  revealCards = 'revealCards',
  gameEnded = 'gameEnded',
  roundEnded = 'roundEnded',
  turnTimeout = 'turnTimeout',
  rebuyRequest = 'rebuyReq',
  leaveWaitingTableResponse = 'leaveWaitingTableRes',
  allUserCount = 'allUserCount',
  userCount = 'userCount',
  destroyInactiveTable = 'destroyInactiveTable',
  maintenance = 'maintenance',
}

export enum LogType {
  request = 'REQ',
  response = 'RES',
  exception = 'EXCEPTION',
}

export type JoinTableRequest = {
  tableType: TableType;
  userId: string;
};

export type UserQueueData = {
  userId: UserID;
  amount: SubWallet;
  expiry: number;
  walletBalance: SubWallet;
  isMaintenanceBypass: boolean;
};

export type SpTableHistoryDto = {
  userId: Types.ObjectId;
  tableId: string;
  startAmount: string;
  endAmount: string;
  tableType: TableType;
};

export type SpRoundHistoryDto = {
  tableId: string;
  tableType: TableType;
  roundNo: number;
  commissionAmount?: string;
  potAmount: string;
  tableCard?: Card;
  winners: string[];
  userInfo: UserInfo[];
  roundStartedAt?: string;
};

export type SpLeaderboardHistoryDto = {
  userId: Types.ObjectId;
  tableId: string;
  roundNo: number;
  tableType: TableType;
  winLoseAmount: number;
  outcome: GameOutcome;
};

export type GameTablePlayers = {
  playerId: PlayerId;
  userId: string;
  walletBalance: SubWallet;
  active: boolean; // playing or sitting out
  startAmount: string;
  roundAmount: string;
  amount: SubWallet;
  username: string;
};

export type GameTableData = {
  tableId: string;
  tableType: TableType;
  roundNo: number;
  players: GameTablePlayers[];
  updatedAt?: string;
};
