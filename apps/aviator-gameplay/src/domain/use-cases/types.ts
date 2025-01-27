import { PlayerSeedProfile } from '@lib/fabzen-common/mongoose/models';
import { Meta } from '@lib/fabzen-common/types';
import { Types } from 'mongoose';

export type RoundInfo = {
  roundNo: number;
  roundStartTime: Date;
  roundStatus: RoundStatus;
};

export enum RoundStatus {
  waiting = 'waiting',
  started = 'started',
  ended = 'ended',
}

export type AviatorRoundHistoryDto = {
  roundNo: number;
  crashValue: number;
  serverSeed: string;
  players: PlayerSeedProfile[];
};

export type AviatorRoundHistoryResponseDto = {
  history: AviatorRoundHistoryDto[];
  meta: Meta;
};

export type AviatorNewRoundHistoryDto = {
  roundNo: number;
  crashValue: number;
  serverSeed: string;
  playerSeed1: string;
  playerSeed2: string;
  playerSeed3: string;
};

export type AviatorUserHistoryDto = {
  userId: Types.ObjectId;
  roundNo: number;
  betAmount: number;
  cashoutAmount: number;
};

export type AviatorUserResponseDto = {
  history: AviatorUserHisotryResult[];
  meta: Meta;
};

export type AviatorUsersBetHistoryDto = {
  userId: string;
  username: string;
  betAmount: number;
  cashoutAmount: number;
  avatar: number;
};

export type AviatorUserHisotryResult = {
  createdAt: Date;
  betAmount: number;
  cashoutAmount: number;
  multiplierValue: number;
  roundNo: number;
  crashValue: number;
};
