import * as dayjs from 'dayjs';
import { Types, ObjectId } from 'mongoose';
import { Wallet } from './user.types';
import { Games } from './games.types';

export type WalletTransactionDto = {
  userId: string;
  amount: string;
  orderId?: string;
  type: TransactionType;
  credit: boolean;
  portions: {
    main: number;
    bonus: number;
    win: number;
  };
  game?: Games;
  tableId?: string;
  tournamentId?: string;
  entryNo?: number;
  expiredAt?: dayjs.Dayjs;
  expired?: boolean;
  referredUserId?: Types.ObjectId;
  referredUserName?: string;
  transactionByUserId?: string;
};

export type CreateTransactionDto = {
  userId: string;
  amount: string;
  orderId?: string;
  type: TransactionType;
  game?: Games;
  tableId?: string;
  tournamentId?: string;
  entryNo?: number;
  breakDown: Wallet;
  expiredAt?: dayjs.Dayjs;
  expired?: boolean;
  referredUserId?: Types.ObjectId;
  referredUserName?: string;
  transactionByUserId?: string;
};

export enum TransactionType {
  deposit = 'deposit',
  withdrawal = 'withdrawal',
  winning = 'winning',
  ludoTournamentPrize = 'ludoTournamentPrize',
  joinFee = 'joinFee',
  referral = 'referral',
  signupBonus = 'signupBonus',
  adminRefund = 'adminRefund',
  ludoTournamentJoinFee = 'ludoTournamentJoinFee',
  slGameJoinFee = 'slGameJoinFee',
  eplGameJoinFee = 'eplGameJoinFee',
  coupon = 'coupon',
  ludoTournamentRefund = 'ludoTournamentRefund',
  withdrawalRefund = 'withdrawalRefund',
  tdsReward = 'tdsReward',
}

export type CalculateDeductionDto = {
  main: string;
  win: string;
  bonus: string;
  amount: string;
  mainPortion: number;
  bonusPortion: number;
  winPortion: number;
  credit: boolean;
  type: TransactionType;
};

export type HistoryParameters = {
  userId: string;
  skip: number;
  limit: number;
};

export type SLRoundHistoryParameters = {
  userId: string;
  tableId: string;
  skip: number;
  limit: number;
};

export type SPRoundHistoryParameters = {
  userId: string;
  tableId: string;
  skip: number;
  limit: number;
};

export type Meta = {
  totalCount: number;
  skip: number;
  limit: number;
};

export type SignUpDto = {
  userId: string;
  wallet: Wallet;
};

export type TransactionData = {
  userId: ObjectId;
  amount: string;
  expireAt?: Date;
  expired?: boolean;
  breakDown: Wallet;
  type: TransactionType;
};
