import { UserGameDetails } from '@lib/fabzen-common/types';

export type TournamentID = string;
export type TableID = string;
export type UserID = string;

export interface WinningPrize {
  minRank: number;
  maxRank: number;
  amount: string;
  percentage: number;
}

export enum NoPlayers {
  two = 2,
  four = 4,
}

export enum GameTypes {
  classic = 'classic',
  quick = 'quick',
  tournament = 'tournament',
  furious4 = 'furious4',
}

export enum GameStatus {
  waiting = 'waiting',
  started = 'started',
  completed = 'completed',
  gameDiscarded = 'gameDiscarded',
}

export type JoinGameResponse = {
  status: GameStatus;
  tableId: string;
  players: Player[];
};

export interface Player {
  playerId: PlayerId;
  userId: string;
}

export interface PlayerStat {
  won: number;
  lost: number;
}

export interface PlayerDetail {
  playerId: string;
  userId: string;
  playerInfo: UserGameDetails;
  stats: PlayerStat;
  lives: number;
}

export enum PlayerId {
  pl1 = 'PL1',
  pl2 = 'PL2',
  pl3 = 'PL3',
  pl4 = 'PL4',
}

export enum DiceValue {
  d1 = 1,
  d2 = 2,
  d3 = 3,
  d4 = 4,
  d5 = 5,
  d6 = 6,
}

export enum PawnId {
  pw1_1 = 'PW1-1',
  pw1_2 = 'PW1-2',
  pw1_3 = 'PW1-3',
  pw1_4 = 'PW1-4',
  pw2_1 = 'PW2-1',
  pw2_2 = 'PW2-2',
  pw2_3 = 'PW2-3',
  pw2_4 = 'PW2-4',
  pw3_1 = 'PW3-1',
  pw3_2 = 'PW3-2',
  pw3_3 = 'PW3-3',
  pw3_4 = 'PW3-4',
  pw4_1 = 'PW4-1',
  pw4_2 = 'PW4-2',
  pw4_3 = 'PW4-3',
  pw4_4 = 'PW4-4',
}

export enum Cell {
  b100 = 'B100',
  b200 = 'B200',
  b300 = 'B300',
  b400 = 'B400',

  c1 = '1',
  c2 = '2',
  c3 = '3',
  c4 = '4',
  c5 = '5',
  c6 = '6',
  c7 = '7',
  c8 = '8',
  c9 = '9',
  c10 = '10',
  c11 = '11',
  c12 = '12',
  c13 = '13',
  c14 = '14',
  c15 = '15',
  c16 = '16',
  c17 = '17',
  c18 = '18',
  c19 = '19',
  c20 = '20',
  c21 = '21',
  c22 = '22',
  c23 = '23',
  c24 = '24',
  c25 = '25',
  c26 = '26',
  c27 = '27',
  c28 = '28',
  c29 = '29',
  c30 = '30',
  c31 = '31',
  c32 = '32',
  c33 = '33',
  c34 = '34',
  c35 = '35',
  c36 = '36',
  c37 = '37',
  c38 = '38',
  c39 = '39',
  c40 = '40',
  c41 = '41',
  c42 = '42',
  c43 = '43',
  c44 = '44',
  c45 = '45',
  c46 = '46',
  c47 = '47',
  c48 = '48',
  c49 = '49',
  c50 = '50',
  c51 = '51',
  c52 = '52',

  h101 = 'H101',
  h102 = 'H102',
  h103 = 'H103',
  h104 = 'H104',
  h105 = 'H105',
  h201 = 'H201',
  h202 = 'H202',
  h203 = 'H203',
  h204 = 'H204',
  h205 = 'H205',
  h301 = 'H301',
  h302 = 'H302',
  h303 = 'H303',
  h304 = 'H304',
  h305 = 'H305',
  h401 = 'H401',
  h402 = 'H402',
  h403 = 'H403',
  h404 = 'H404',
  h405 = 'H405',

  home = 'Home',
}

export enum GameAction {
  rollDice = 'rollDice',
  movePawn = 'movePawn',
  skipTurn = 'skipTurn',
  endGame = 'endGame',
  leaveTable = 'leaveTable',
  discardGame = 'discardGame',
}

export interface PawnPosition {
  pawn: PawnId;
  position: Cell;
  usedDice?: DiceValue;
}

export interface PawnResponse {
  movedPawns: PawnPosition[];
  scores: Scores;
}

export interface PlayerInfo {
  playerId: PlayerId;
  userId: string;
  lives: number;
  didLeave: boolean;
  got6: boolean;
  canGet6: boolean;
}

export interface WaitingTable {
  [key: string]: PlayerId | string;
}

export interface TableInfo {
  tableId: string;
  tableTypeId?: string;
  gameType: GameTypes;
  joinFee?: string;
  players: PlayerInfo[];
  tournamentId?: TournamentID;
  roundNo?: number;
}

export interface TableState {
  tableId: string;
  pawnPositions: PawnPosition[];
  currentTurn: PlayerId;
  turnNo: number;
  action: GameAction;
  lastDiceValues: DiceValue[]; // last dice rolling results (either the current or the previous player)
  readyPlayers: PlayerId[];
  extraChances: number; // add one when Landed on Home or Killed other pawn
  timeout: string;
}

export interface Table {
  tableInfo: TableInfo;
  tableState: TableState;
}

export interface CanMovePawn {
  pawn: PawnId;
  dices: DiceValue[];
}

export interface NextAction {
  player: PlayerId;
  action: GameAction;
  canMovePawns?: CanMovePawn[];
  timeout: string; // ISO Date
  lives?: number[];
}

export interface UserState {
  tableId?: string;
  clientId?: string;
}

export interface TableEvent {
  name: string;
  payload: any;
}

export interface Event {
  eventName: string;
  eventPayload: any;
}

export type JoinTableRequest = {
  userId: UserID;
  joinFee: string;
  type: GameTypes;
  roomSize: number;
};

export type JoinTableInfo = {
  status: GameStatus;
  tableId: string;
  keyExpiryTime: number;
  players: Player[];
  myPlayerId: PlayerId;
};

export type SaveGameTableParameter = {
  tableTypeId?: string;
  gameType: GameTypes;
  tableId: string;
  joinFee?: string;
  players: Player[];
  tournamentId?: TournamentID;
  winAmount?: string;
  winAmountPercentage?: number;
  roundNo?: number;
};

export interface PlayerStatWithUserId extends PlayerStat {
  userId: string;
}

export interface LudoQueueJobData {
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
  type: GameTypes;
  players: PlayerDetail[];
  winningAmount?: string;
  joinFee?: string;
  myPlayerId?: PlayerId;
  timeout?: string;
  endAt?: string;
}

export type StartRoundEvent = {
  table: {
    tableId: TableID;
    type: GameTypes;
    players: PlayerDetail[];
    myPlayerId?: PlayerId;
  };
  tournamentData: {
    tournamentId: TournamentID;
    tournamentName: string;
    maxNoPlayers: number;
    noPlayersPerGame: number;
    noJoinedPlayers: number;
    joinFee: string;
    winningPrizes: WinningPrize[];
    totalAmount: string;
    winnerCount: number;
    roundInfo: {
      roundNo: number;
      totalRounds: number;
      startAt: string;
      endAt: string;
      remainingUsers: number;
    };
  };
};

export type HashSetResult = {
  [key: string]: string;
};

export interface TableInitParameters {
  tableId: string;
  gameType: GameTypes;
  tableTypeId?: string;
  joinFee?: string;
  players: Player[];
  tournamentId?: TournamentID;
  roundNo?: number;
  timeout?: string;
}

export interface RollDiceRequest {
  tableId: string;
  userId: string;
}

export interface RollDiceResponse {
  dice: DiceValue;
  nextAction: NextAction;
}

export interface NextActionResponse {
  userId: string;
  nextAction: NextAction;
}

export interface LeaveTableData {
  tableId: string;
  userId: string;
}

export interface SkipTurnRequest {
  tableId: string;
  userId: string;
}

export interface MovePawnRequest {
  tableId: string;
  userId: string;
  pawn: PawnId;
  dice: DiceValue;
}

export interface MovePawnResponse {
  movedPawns: PawnPosition[];
  scores: Scores;
  nextAction?: NextAction;
  winner?: PlayerInfo;
}

export type Scores = Partial<{
  [PlayerId.pl1]: number;
  [PlayerId.pl2]: number;
  [PlayerId.pl3]: number;
  [PlayerId.pl4]: number;
}>;

export type ConnectedRequest = {
  userId: UserID;
};

export type ForceReconnectRequest = {
  tableId?: TableID;
};

export type ForceReconnectTournamentRequest = {
  tournamentId: TournamentID;
};

type ReconnectBaseFields = {
  isReconnected: boolean;
  status: GameStatus;
  gameType: GameTypes;
  roomSize?: number;
};

export type GameTableData = {
  action: GameAction;
  timeout: string;
  currentTurn: PlayerId;
  lastDiceValues: DiceValue[];
  pawnPositions: PawnPosition[];
  canMovePawns: CanMovePawn[] | undefined;
};

export type GameTableFullData = GameTableData & {
  myPlayerId: PlayerId;
  playersDetail: PlayerDetail[];
};

export type TournamentData = {
  tournamentId: TournamentID;
  tournamentName: string;
  winnerCount: number;
  maxNoPlayers: number;
  noJoinedPlayers: number;
  winningPrizes: WinningPrize[];
  totalAmount: string;
  noPlayersPerGame: number;
  joinFee: string;
  roundInfo: RoundInfo;
};

export type RoundInfo = {
  roundNo: number;
  totalRounds: number;
  startAt: string;
  endAt: string;
  remainingUsers: number;
};

export type TableData = {
  type: GameTypes;
  tableId: TableID;
  players?: PlayerDetail[];
  myPlayerId: PlayerId;
  joinFee?: string;
};

export type RoundFinishedData = {
  tableId: TableID;
  winners: PlayerId[];
  roundNo: number;
};

export type ReconnectNormalGameResponse = ReconnectBaseFields & {
  gameInfo?: ReconnectGameInfo;
  waitingInfo?: WaitingInfo;
  tableId?: string;
  winner?: string;
  winningAmount?: string;
  action?: GameAction;
  timeout?: string;
  currentTurn?: PlayerId;
  lastDiceValues?: DiceValue[];
  pawnPositions?: PawnPosition[];
  canMovePawns?: CanMovePawn[];
  tableTypeId?: string;
};

export type ForceReconnectGameResponse = Partial<ReconnectGameInfo> & {
  isReconnected: boolean;
  status: GameStatus;
  tableId?: string;
  winner?: string;
  winningAmount?: string;
  myPlayerId?: PlayerId;
  players?: {
    playerId: PlayerId;
    name: string;
    avatar: number;
    totalScore: number;
    isWinner: boolean;
    winAmount: string;
  }[];
};

export type ReconnectTournamentResponse = ReconnectBaseFields &
  Partial<{
    gameTableData: GameTableData;
    tournamentData: TournamentData;
    table: TableData;
    roundFinished: RoundFinishedData;
  }>;

export type ReconnectResponse =
  | ReconnectNormalGameResponse
  | ReconnectTournamentResponse;

export interface WaitingInfo {
  gameType: GameTypes;
  joinFee: string;
  timeout: string;
  roomSize: number;
  winningAmount?: string;
  usernames?: UserNameWithAvatar[];
  userDetails: UserGameDetails;
}

export interface ReconnectGameInfo {
  table: ReconnectTableInfo;
  pawnPositions: PawnPosition[];
  canMovePawns?: CanMovePawn[];
  currentTurn: PlayerId;
  action?: GameAction;
  lastDiceValues: DiceValue[];
  timeout?: string;
}

export interface ReconnectTableInfo {
  tableId?: string;
  type: GameTypes;
  players?: PlayerDetail[];
  myPlayerId: PlayerId;
  winningAmount?: string;
  joinFee?: string;
  endAt?: string;
}

export interface LeaveTableRequest {
  tableId: string;
  userId: string;
}

export interface LeaveTableResponse {
  leftPlayerId: PlayerId;
  endGameResult?: EndGameResult;
}

export enum LeaveWaitingTableStatus {
  cancelled = 'cancelled',
  joined = 'joined',
}

export interface LeaveWaitingTableResponse {
  status: LeaveWaitingTableStatus;
}

export interface EndGameResult {
  winner: PlayerInfo;
  winningAmount: string;
}

export interface GameFinishedMessage {
  winner?: PlayerId;
  winners?: PlayerId[];
  winningAmount?: string;
  players: {
    playerId: PlayerId;
    name: string;
    avatar: number;
    totalScore: number;
    isWinner: boolean;
    winAmount: string;
  }[];
}

export type RoundFinishedMessage = {
  winners: PlayerId[];
  roundNo: number;
};

export interface SkipTurnResponse {
  nextAction: NextAction;
  leftTable?: LeaveTableResponse;
}

export type SendEmojiRequest = {
  tableId: TableID;
  sender: PlayerId;
  emojiIndex: number;
};

export type SendMessageRequest = {
  tableId: TableID;
  sender: PlayerId;
  message: string;
};

export interface ReadyToStartResponse {
  isReady: boolean;
  nextAction?: NextAction;
}

export interface ReadyToStartRequest {
  tableId: string;
  userId: string;
}

export interface GetLastGameEventRequest {
  tableId: string;
}

export type JoinTournamentRequest = {
  userId: UserID;
  tournamentId: TournamentID;
};

export type RoundStartEvent = {
  tournamentId: TournamentID;
  tournamentName: string;
  roundNo: number;
  userIds: UserID[];
  maxNoPlayers: number;
  noPlayersPerGame: number;
  noJoinedPlayers: number;
  joinFee: string;
  winningPrizes: WinningPrize[];
  totalAmount: string;
  winnerCount: number;
  totalRounds: number;
  startAt: string;
  remainingUsers: number;
};

export type TournamentStartEvent = {
  tournamentId: TournamentID;
  tournamentName: string;
  startAt: string;
  userIds: UserID[];
};

export type RoundDuration = {
  noPlayers: number;
  duration: number;
  unit: string;
};

export type TournamentForceTerminatedEvent = {
  tournamentId: TournamentID;
  reason: string;
};

export type TournamentJoiners = {
  tournamentId: TournamentID;
  tournamentName: string;
  userIds: UserID[];
};

export type IgnoreTournamentRequest = {
  tournamentId: TournamentID;
};

export type ChangeTableRequest = {
  tableId: TableID;
};

export type GetLeftPlayerListRequest = {
  tableId: TableID;
};

export type GetRoundInfoRequest = {
  tournamentId: TournamentID;
  roundNo: number;
  userId: UserID;
};

export type totalGameResponse = {
  quickGamesTotal: number;
  quickGamesAmount: number;
  tournamentGamesTotal: number;
  classicGamesTotal: number;
  classicGamesAmount: number;
  furious4GamesTotal: number;
  furious4GamesAmount: number;
};

export type GameDataRequest = {
  tableId: string;
  userId: string;
};

export type CheckIfJoinedRequest = {
  tableId?: TableID;
};

export type winAmountPercentage = {
  joinFee?: string;
};

export type GameStatusRequest = {
  tableId: string;
};

export type UserNameWithAvatar = {
  name: string;
  avatarIndex: number;
  userId: string;
};

export type MatchingTable = {
  type: GameTypes;
  joinFee: string;
  timeout: string;
};

export type RecentWinner = {
  username: string;
  gameType: GameTypes;
  amount: number;
};

export type UserNameProfilePic = {
  userId: string;
  username: string;
  name?: string;
  profileAvatar?: number;
};

export type CreateLudoGameHistoryDto = {
  tableId: string;
  userIds: string[];
  joinFee: string;
  gameType: GameTypes;
  roomSize: number;
};

export type GameEndedDto = {
  winners: PlayerInfo[];
  winningAmount: string;
  tableId: string;
  losers: string[];
  joinFee: string;
};

export type WaitingUser = {
  expiry: number;
  ip: string;
  userDetails: UserGameDetails;
  tableTypeId: string;
};
