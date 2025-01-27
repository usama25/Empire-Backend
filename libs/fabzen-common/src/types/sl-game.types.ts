import { MobileNumber } from './';
import { PlayerId } from 'apps/sl-gameplay/src/domain/entities';
import { Stat } from './';
import { Address } from './';

export enum SLGameOutCome {
  won = 'won',
  lost = 'lost',
}
export enum SLGameTableStatus {
  stuck = 'stuck',
  ongoing = 'ongoing',
}
export interface SLGameWinningPrize {
  minRank: number;
  maxRank: number;
  amount: string;
  percentage: number;
}

export type TableTypeId = string;

export type UserSLGameInfo = {
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
};

export type UserSLGameInfoForLiveApi = {
  playerId: PlayerId;
  userId: string;
  name?: string;
  username: string;
  didLeave: boolean;
};

export type SLGameTableData = {
  tableId: string;
  joinFee: string;
  status: SLGameTableStatus;
  players: UserSLGameInfoForLiveApi[];
  startedAt?: Date;
  updatedAt?: Date;
};
