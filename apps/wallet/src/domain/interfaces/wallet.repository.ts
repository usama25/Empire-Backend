import { WalletEntity } from '@lib/fabzen-common/entities/wallet.entity';
import { WalletDto } from '../../infrastructure/controllers/dtos/wallet.transporter.dto';
import { ReferralHistoryResponseDto } from 'apps/rest-api/src/subroutes/promo/referral/referral.dto';
import {
  HistoryParameters,
  TransactionData,
  ReferralBonusDto,
  SubWallet,
  UserID,
  LudoMegaTournamentPrize,
} from '@lib/fabzen-common/types';
import {
  AdminRefundRequestBody,
  BonusHistoryResponseDto,
  RefundHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/transaction/transaction.dto';
import { PrizeCredit } from 'apps/ludo-tournament/src/ludo-tournament.types';

export abstract class WalletRepository {
  abstract getWallet(userId: string): Promise<WalletEntity | undefined>;

  abstract creditDepositToWallet({
    userId,
    orderId,
    amount,
  }: WalletDto): Promise<void>;

  abstract debitPayoutFromWallet({
    userId,
    orderId,
    amount,
  }: WalletDto): Promise<void>;

  abstract creditPayoutRefundToWallet({
    userId,
    orderId,
    amount,
  }: WalletDto): Promise<void>;

  abstract creditTaxRewardToWallet({
    userId,
    orderId,
    amount,
  }: WalletDto): Promise<void>;

  abstract getReferralHistory(
    historyParameters: HistoryParameters,
  ): Promise<ReferralHistoryResponseDto>;

  abstract creditSignupBonus(userId: string): Promise<void>;

  abstract spDebitJoinFee(
    userId: string,
    amount: SubWallet,
    tableId: string,
  ): Promise<void>;

  abstract cbrDebitJoinFee(
    userId: string,
    amount: SubWallet,
    tableId: string,
  ): Promise<void>;

  abstract reDebitJoinFee(
    userId: string,
    amount: SubWallet,
    tableId: string,
  ): Promise<void>;

  abstract spAddWinningAmount(
    userId: string,
    amount: SubWallet,
    tableId: string,
    isRefund?: boolean,
  ): Promise<void>;

  abstract cbrAddWinningAmount(
    userId: string,
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ): Promise<void>;

  abstract reAddWinningAmount(
    userId: string,
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ): Promise<void>;

  abstract getExpiredBonusTransactions(
    userId: string,
  ): Promise<TransactionData[]>;

  abstract processExpiredBonusTransactions(
    transactionData: TransactionData[],
  ): Promise<void>;

  abstract creditReferralBonus(
    referralBonusDto: ReferralBonusDto,
  ): Promise<void>;

  abstract getBonusHistory(
    historyParameters: HistoryParameters,
  ): Promise<BonusHistoryResponseDto>;

  abstract getRefundHistory(
    historyParameters: HistoryParameters,
  ): Promise<RefundHistoryResponseDto>;

  abstract debitAviatorBetAmount(
    roundNo: number,
    userId: string,
    amount: string,
    bonusPercentage: number,
  ): Promise<boolean>;

  abstract creditAviatorWinningAmount(
    roundNo: number,
    userId: string,
    amount: string,
  ): Promise<void>;

  abstract adminRefund(
    userId: string,
    adminRefundBody: AdminRefundRequestBody,
  ): Promise<void>;

  abstract debitLudoJoinFee(
    userId: string,
    amount: string,
    bonusPercentage: number,
    tableId: string | undefined,
    tournamentId: string | undefined,
  ): Promise<void>;

  abstract debitSLJoinFee(
    userId: string,
    amount: string,
    bonusPercentage: number,
    tableId: string | undefined,
  ): Promise<void>;

  abstract debitEPLJoinFee(
    userId: string,
    joinFee: string,
    bonusPercentage: number,
    tableId: string | undefined,
  ): Promise<void>;

  abstract creditSLWinningAmount(
    userId: string,
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ): Promise<void>;

  abstract creditLudoWinningAmount(
    userId: string,
    amount: string,
    tableId: string,
  ): Promise<void>;

  abstract creditLudoTournamentPrize(
    tournamentId: string,
    prizeCredits: PrizeCredit[],
  ): Promise<void>;

  abstract refundLudoTournamentJoinFee(tournamentId: string): Promise<void>;

  abstract debitLudoMegaTournamentJoinFee(
    userId: UserID,
    amount: string,
    tournamentId: string,
    entryNo: number,
    bonusPercentage: number,
  ): Promise<void>;

  abstract creditLudoMegaTournamentPrizes(
    tournamentId: string,
    prizes: LudoMegaTournamentPrize[],
  ): Promise<void>;

  abstract convertToMain(
    userId: string,
    orderId: string,
    amount: string,
    reward: string,
  ): Promise<void>;

  abstract refundTournamentJoinFees(tournamentId: string): Promise<void>;
}

export const createMockWalletRepository = (): WalletRepository => ({
  getWallet: jest.fn(),
  creditDepositToWallet: jest.fn(),
  debitPayoutFromWallet: jest.fn(),
  creditPayoutRefundToWallet: jest.fn(),
  getReferralHistory: jest.fn(),
  creditSignupBonus: jest.fn(),
  reDebitJoinFee: jest.fn(),
  spDebitJoinFee: jest.fn(),
  cbrDebitJoinFee: jest.fn(),
  reAddWinningAmount: jest.fn(),
  spAddWinningAmount: jest.fn(),
  cbrAddWinningAmount: jest.fn(),
  getExpiredBonusTransactions: jest.fn(),
  processExpiredBonusTransactions: jest.fn(),
  creditReferralBonus: jest.fn(),
  getBonusHistory: jest.fn(),
  getRefundHistory: jest.fn(),
  adminRefund: jest.fn(),
  debitLudoJoinFee: jest.fn(),
  creditLudoWinningAmount: jest.fn(),
  creditLudoTournamentPrize: jest.fn(),
  creditTaxRewardToWallet: jest.fn(),
  refundLudoTournamentJoinFee: jest.fn(),
  debitLudoMegaTournamentJoinFee: jest.fn(),
  debitAviatorBetAmount: jest.fn(),
  creditAviatorWinningAmount: jest.fn(),
  convertToMain: jest.fn(),
  debitSLJoinFee: jest.fn(),
  creditSLWinningAmount: jest.fn(),
  creditLudoMegaTournamentPrizes: jest.fn(),
  refundTournamentJoinFees: jest.fn(),
  debitEPLJoinFee: jest.fn(),
});
