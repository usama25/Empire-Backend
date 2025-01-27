import { PaginationParameters } from '@lib/fabzen-common/types';
import {
  Player,
  PlayerDetail,
  PlayerId,
  Scores,
} from 'apps/ludo-gameplay/src/ludo-gameplay.types';

export type RoundEndResult = {
  tableId: string;
  winners: PlayerId[];
  scores: Scores;
  players: Player[];
};

export type RoundEndFullResult = {
  tournamentId: string;
  roundNo: number;
  roundEndResults: RoundEndResult[];
};

export type PrizeCredit = {
  userId: string;
  winAmount: string;
};

export type RoundInfo = {
  startAt: string;
  players?: PlayerDetail[];
};

export type RoundResult = {
  winAmount?: string;
  rank?: number;
  rounds?: roundData[];
};

export type roundData = {
  roundNo: number;
  score: number;
  roomCode: string;
};

export type TournamentTerminationData = {
  tournamentId: string;
  reason: string;
};

export type CheckIfFinishedResult = {
  finished: boolean;
  tournamentId?: string;
  tournamentName?: string;
  noPlayersPerGame?: number;
  rank?: number;
  prize?: string;
};

export type RoundEndResponse = {
  finished: boolean;
  tournamentId?: string;
  tournamentName?: string;
  noPlayersPerGame?: number;
  lastRoundLeaderboard?: {
    userId: string;
    rank: number;
    prize: string;
  }[];
  responseRecipients: string[];
};

export type TournamentChangedEvent = {
  tournamentId: string;
  joinedPlayer: number;
  totalRounds: number;
};

export type TournamentBasicInfo = {
  name: string;
  _id: string;
  joinFee: string;
  createdAt: Date;
};

export type PaginationWithtableReportFilterParameter = {
  filter?: object;
  startDate?: string;
  endDate?: string;
  joinfee?: string;
};

export type UserTournamentStatus = {
  canPlay: boolean;
  isRegistered: boolean;
};

export type UserRank = {
  rank: number;
  winAmount: string;
};

export type GetTournamentByIdRequest = {
  tournamentId: string;
  userId?: string;
};

export type GetMyRankRequest = {
  tournamentId: string;
  userId: string;
};

export type GetUserStatusRequest = {
  tournamentId: string;
  userId: string;
};

export type CheckIfFinishedRequest = {
  tournamentId: string;
  roundNo: number;
  userId: string;
};

export type GetRoundResultRequest = {
  tournamentId: string;
  userId: string;
};

export type GetRoundInfoRequest = {
  tournamentId: string;
  roundNo: number;
  userId: string;
};

export type GetLeaderboardRequest = {
  tournamentId: string;
  roundNo: number;
  userId: string;
  skip: number;
  limit: number;
};

export type FirebaseDynamicLinkRequest = {
  tournamentId: string;
  appId: string;
  domainUriPrefix: string;
  packageName: string;
};

export interface WinningPrize {
  minRank: number;
  maxRank: number;
  amount: string;
  percentage: number;
}

export type TournamentDTO = {
  id: string;
  name: string;
  alias?: string;
  noPlayersPerGame: number;
  joinFee: string;
  status: TournamentStatus;
  startAt: Date;
  endAt: Date;
  registerTill: Date;
  maxNoPlayers: number;
  minNoPlayers: number;
  isRepeatable: boolean;
  isAutomatic: boolean;
  winningPrizes: WinningPrize[];
  activatedAt?: Date;
  filledAt?: Date;
  currentRoundNo: number;
  isActive?: boolean;
  isDeleted: boolean;
  totalRounds: number;
  winnerCount: number;
  totalAmount: string;
  canPlay?: boolean;
  noJoinedPlayers: number;
  dynamicLink?: string;
  lwDynamicLink?: string;
  remainingUsers?: number;
  createdAt?: Date;
  featured?: boolean;
  custom?: boolean;
};

export interface TournamentPlayer {
  userId: string;
  lostRoundNo: number;
  lastPlayedRoundNo: number;
  lastRoundScore: number;
  rank: number;
  rounds: TournamentPlayerRoundInfo[];
}

export interface TournamentPlayerLeaderBoard {
  userId: string;
  roundNo: number;
  rank: number;
  score: number;
  winAmount: string;
}

export interface TournamentPlayerRoundInfo {
  roundNo: number;
  tableId: string;
  score: number;
}

export enum TournamentStatus {
  created = 'created',
  activated = 'activated',
  full = 'full',
  started = 'started',
  ended = 'ended',
  deleted = 'deleted',
  canceled = 'canceled',
}

export type LeaderboardDTO = {
  userId?: string;
  rank: number;
  score: number;
  winAmount: string;
  userName?: string;
};

export type TournamentFilterWithPagination = PaginationParameters & {
  sortBy: string;
  sortDir: number;
  noPlayersPerGame: number;
  minJoinFee: string;
  maxJoinFee: string;
  winnerCount: 'single' | 'multi';
  userId: string;
  isActive: boolean;
  joinable: boolean;
  featured: boolean;
};
