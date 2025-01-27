import { UserGameDetails } from '@lib/fabzen-common/types';

export interface Table {
  tableId: string;
  myPlayerId?: PlayerId;
  tableType: TableType;
  roundNo: number;
  handNo: number;
  totalRounds: number;
  dealerId: PlayerId;
  currentTurn: PlayerId;
  gameStatus: GameStatus;
  players: PlayerInfo[];
  turnNo: number;
  firstCard?: Card;
  leadCard?: Card;
  timeout?: string;
  roundStartedAt?: Date;
  updatedAt: string;
}

export interface PlayerInfo {
  playerId: PlayerId;
  userId: string;
  active: boolean; // playing or sitting out
  handBid: number;
  currentHand: number;
  scores: string[];
  totalScore: string;
  roundScore: string;
  cards?: GameCard[];
  currentCard?: Card;
  playerInfo: UserGameDetails;
}

export interface GameCard {
  card: Card;
  thrown: boolean;
}

export enum CardGroup {
  diamond = 'diamond',
  club = 'club',
  heart = 'heart',
  spade = 'spade',
}

export interface TableType {
  tableTypeId: string;
  amount: string;
  winnings: string;
  totalRounds: number;
}

export enum GameStatus {
  waiting = 'waiting',
  roundStarted = 'roundStarted',
  handBid = 'handBid',
  dealCards = 'dealCards',
  playing = 'playing',
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
  profileAvatar: number;
}

export enum PlayerId {
  pl1 = 'PL1',
  pl2 = 'PL2',
  pl3 = 'PL3',
  pl4 = 'PL4',
}

export enum Card {
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
}

export const CardsDeck = [
  'H,2',
  'H,3',
  'H,4',
  'H,5',
  'H,6',
  'H,7',
  'H,8',
  'H,9',
  'H,10',
  'H,11',
  'H,12',
  'H,13',
  'H,14',
  'S,2',
  'S,3',
  'S,4',
  'S,5',
  'S,6',
  'S,7',
  'S,8',
  'S,9',
  'S,10',
  'S,11',
  'S,12',
  'S,13',
  'S,14',
  'D,2',
  'D,3',
  'D,4',
  'D,5',
  'D,6',
  'D,7',
  'D,8',
  'D,9',
  'D,10',
  'D,11',
  'D,12',
  'D,13',
  'D,14',
  'C,2',
  'C,3',
  'C,4',
  'C,5',
  'C,6',
  'C,7',
  'C,8',
  'C,9',
  'C,10',
  'C,11',
  'C,12',
  'C,13',
  'C,14',
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
  deleteTable = 'deleteTable',
  startRound = 'startRound',
  startPlaying = 'startPlaying',
  afterDealCards = 'afterDealCards',
  skipCurrentHand = 'skipCurrentHand',
  handBid = 'handBid',
  nextHand = 'nextHand',
  dealCards = 'dealCards',
  throwCard = 'throwCard',
  roundEnded = 'roundEnded',
  skipTurn = 'skipTurn',
  endGame = 'endGame',
  next = 'next',
}

export interface PlayerCardsInfo {
  category: CardsCategory;
  cards: [Card, Card, Card];
}

export interface PlayerEndInfo {
  playerId: PlayerId;
  playerCardsInfo?: PlayerCardsInfo;
  handCards?: [Card, Card, Card];
  amount?: string;
  playerAmount: string;
}

export interface UserInfo {
  userId: string;
  username: string;
  winLossAmount: string;
  outcome: string;
  betAmount: string;
  status: string;
  playerAmount: string;
  playerCardsInfo?: PlayerCardsInfo;
  handCards?: [Card, Card, Card];
}

export interface PlayerGameEndInfo {
  playerId: string;
  name: string;
  avatar: number;
  totalScore: string;
  winAmount: string;
  isWinner: boolean;
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

export interface PlayerInfo1 {
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

export enum GameLog {
  leaveTable = 'leaveTable',
  handBid = 'handBid',
  autoHandBid = 'autoHandBid',
  autoThrowCard = 'autoThrowCard',
  throwCard = 'throwCard',
  throwCardResponse = 'throwCardResponse',
  scoreboard = 'scoreboard',
  reconnectGame = 'reconnectGame',
  exception = 'exception',
  joinTable = 'joinTable',
  startRound = 'startRound',
  initialBet = 'initialBet',
  dealCards = 'dealCards',
  playerLeftTable = 'playerLeftTable',
  leaveWaitingTable = 'leaveWaitingTable',
  matchingTimeout = 'matchingTimeout',
  checkIfJoined = 'checkIfJoined',
  joinTableResponse = 'joinTableRes',
  revealCards = 'revealCards',
  gameEnded = 'gameEnded',
  roundEnded = 'roundEnded',
  turnTimeout = 'turnTimeout',
  rebuyRequest = 'rebuyReq',
  allUserCount = 'allUserCount',
  userCount = 'userCount',
  destroyInactiveTable = 'destroyInactiveTable',
  maintenance = 'maintenance',
}

export enum LogType {
  request = 'REQ',
  response = 'RES',
  exception = 'EXCEPTION',
  auto = 'AUTO',
}

export type JoinTableRequest = {
  tableType: TableType;
  userId?: string;
};

export type HandBidRequest = {
  hand: number;
};

export type ThrowCardRequest = {
  card: Card;
};

export type ScoreBoardData = {
  scoreboard: BoardData[];
  tableId: string;
  isFinalRound: boolean;
};

export type BoardData = {
  playerId: PlayerId;
  username: string;
  active: boolean;
  name?: string;
  avatar: number;
  scores: string[];
  totalScore: string;
};

export type GameTablePlayers = {
  playerId: PlayerId;
  userId: string;
  username: string;
};

export type GameTableData = {
  tableId: string;
  tableType: TableType;
  players: GameTablePlayers[];
  roundNo: number;
  gameStatus: GameStatus;
  totalRounds: number;
  updatedAt: string;
};

export type JoinTableInfo = {
  status: GameStatus;
  tableId: string;
  keyExpiryTime: number;
  players: Player[];
  myPlayerId: PlayerId;
};

export type EndTableResult = {
  winner: string;
  winningAmount: string;
};

export type FlushTableRequest = {
  tableId: string;
};

export type ReadyRequest = {
  userIds: string[];
  tableId: string;
};

export type ReadyResponse = {
  tableId: string;
  amount: string;
  userId: string;
};

export type CreateTableParameter = {
  tableType: TableType;
  userId: string;
};

export type JoinTableParameter = {
  waitingTable: Table;
  userId: string;
};

export interface PlayerStatWithUserId extends PlayerStat {
  userId: string;
}

export interface CbrQueueJobData {
  tableId: string;
  action: string;
  payload?: any;
}

export interface TimeoutRequest {
  prevAction: string;
  action: string;
  nextAction: string;
}

export interface JoinTableResponse {
  tableId: string;
  tableType: TableType;
  players: PlayerDetail[];
}

export type HashSetResult = {
  [key: string]: string;
};

export interface LeaveTableData {
  tableId: string;
  userId: string;
}

export interface WaitingInfo {
  gameType: TableType;
  timeout: string;
  winningAmount: string;
  joinFee: string;
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

export interface ReadyToStartResponse {
  isReady: boolean;
  nextAction?: NextAction;
}

export interface ReadyToStartRequest {
  tableId: string;
  userId: string;
}
