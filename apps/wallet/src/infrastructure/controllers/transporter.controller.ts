import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { MessageData } from '@lib/fabzen-common/decorators';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import {
  HistoryParameters,
  LudoMegaTournamentPrize,
  SubWallet,
  TransporterCmds,
  UserID,
} from '@lib/fabzen-common/types';
import { WalletEntity } from '@lib/fabzen-common/entities/wallet.entity';

import { ReferralHistoryResponseDto } from 'apps/rest-api/src/subroutes/promo/referral/referral.dto';
import { PrizeCredit } from 'apps/ludo-tournament/src/ludo-tournament.types';

import { WalletUseCases } from '../../domain/use-cases';
import { WalletDto, GetWalletDto } from './dtos/wallet.transporter.dto';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class WalletTransporterController {
  constructor(private readonly walletUseCases: WalletUseCases) {}

  @MessagePattern(TransporterCmds.GET_WALLET)
  async getWallet(
    @MessageData() getWalletDto: GetWalletDto,
  ): Promise<WalletEntity | undefined> {
    const { userId } = getWalletDto;
    return await this.walletUseCases.getWallet(userId);
  }

  @MessagePattern(TransporterCmds.CREDIT_DEPOSIT_TO_WALLET)
  async creditDepositToWallet(@MessageData() creditDepositDto: WalletDto) {
    const { userId, amount, orderId } = creditDepositDto;
    await this.walletUseCases.creditDepositToWallet({
      userId,
      amount,
      orderId,
    });
    return true;
  }

  @MessagePattern(TransporterCmds.CREDIT_PAYOUT_REFUND_TO_WALLET)
  async creditPayoutRefundToWallet(@MessageData() creditPayoutDto: WalletDto) {
    const { userId, amount, orderId } = creditPayoutDto;
    await this.walletUseCases.creditPayoutRefundToWallet({
      userId,
      amount,
      orderId,
    });
    return true;
  }

  @MessagePattern(TransporterCmds.CREDIT_TAX_REWARD_TO_WALLET)
  async creditTaxRewardToWallet(@MessageData() creditPayoutDto: WalletDto) {
    const { userId, amount, orderId } = creditPayoutDto;
    await this.walletUseCases.creditTaxRewardToWallet({
      userId,
      amount,
      orderId,
    });
    return true;
  }

  @MessagePattern(TransporterCmds.REFERRAL_HISTORY)
  async getReferralHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<ReferralHistoryResponseDto> {
    return await this.walletUseCases.getReferralHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.CREDIT_SIGNUP_BONUS)
  async signupBonus(
    @MessageData() { userId }: { userId: string },
  ): Promise<void> {
    await this.walletUseCases.creditSignupBonus(userId);
  }

  @MessagePattern(TransporterCmds.CHECK_WALLET_BALANCE)
  async checkSpWalletBalance(
    @MessageData() { userId, amount }: { userId: string; amount: string },
  ) {
    return await this.walletUseCases.checkSpWalletBalance(userId, amount);
  }

  @MessagePattern(TransporterCmds.RE_CHECK_WALLET_BALANCE)
  async checkReWalletBalance(
    @MessageData() { userId, amount }: { userId: string; amount: string },
  ) {
    return await this.walletUseCases.checkReWalletBalance(userId, amount);
  }

  @MessagePattern(TransporterCmds.CBR_CHECK_WALLET_BALANCE)
  async checkCbrWalletBalance(
    @MessageData() { userId, amount }: { userId: string; amount: string },
  ) {
    return await this.walletUseCases.checkCbrWalletBalance(userId, amount);
  }

  @MessagePattern(TransporterCmds.EXPIRE_BONUS)
  async expiredBonus(
    @MessageData() { userId }: { userId: string },
  ): Promise<void> {
    await this.walletUseCases.expiredBonus(userId);
  }

  @MessagePattern(TransporterCmds.CREDIT_RERERRAL_BONUS)
  async referralBonus(
    @MessageData()
    {
      userId,
      referredUserId,
      amount,
    }: {
      userId: string;
      referredUserId: string;
      amount: string;
    },
  ): Promise<void> {
    await this.walletUseCases.creditReferralBonus(
      userId,
      referredUserId,
      amount,
    );
  }

  @MessagePattern(TransporterCmds.SP_DEBIT_JOIN_FEE)
  async joinFeeToBeDebitedForTable(
    @MessageData()
    {
      userIds,
      amounts,
      tableId,
    }: {
      userIds: string[];
      amounts: SubWallet[];
      tableId: string;
    },
  ) {
    await this.walletUseCases.spJoinFeeToBeDebitedForTable(
      userIds,
      amounts,
      tableId,
    );
  }

  @MessagePattern(TransporterCmds.RE_DEBIT_JOIN_FEE)
  async reDebitJoinFee(
    @MessageData()
    {
      userIds,
      amounts,
      tableId,
    }: {
      userIds: string[];
      amounts: string[];
      tableId: string;
    },
  ) {
    await this.walletUseCases.reDebitJoinFee(userIds, amounts, tableId);
  }

  @MessagePattern(TransporterCmds.CBR_DEBIT_JOIN_FEE)
  async cbrDebitJoinFee(
    @MessageData()
    {
      userIds,
      amount,
      tableId,
    }: {
      userIds: string[];
      amount: string;
      tableId: string;
    },
  ) {
    await this.walletUseCases.cbrDebitJoinFee(userIds, amount, tableId);
  }

  @MessagePattern(TransporterCmds.SP_ADD_WINNING_AMOUNT)
  async addWinningAmount(
    @MessageData()
    {
      userIds,
      amounts,
      tableId,
      isRefund,
    }: {
      userIds: string[];
      amounts: SubWallet[];
      tableId: string;
      isRefund?: boolean;
    },
  ) {
    await this.walletUseCases.spAddWinningAmount(
      userIds,
      amounts,
      tableId,
      isRefund,
    );
  }

  @MessagePattern(TransporterCmds.RE_ADD_WINNING_AMOUNT)
  async addReWinningAmount(
    @MessageData()
    {
      userIds,
      amount,
      tableId,
      isRefund,
    }: {
      userIds: string[];
      amount: string;
      tableId: string;
      isRefund?: boolean;
    },
  ) {
    await this.walletUseCases.reAddWinningAmount(
      userIds,
      amount,
      tableId,
      isRefund,
    );
  }

  @MessagePattern(TransporterCmds.CBR_ADD_WINNING_AMOUNT)
  async addCbrWinningAmount(
    @MessageData()
    {
      userIds,
      amount,
      tableId,
      isRefund,
    }: {
      userIds: string[];
      amount: string;
      tableId: string;
      isRefund?: boolean;
    },
  ) {
    await this.walletUseCases.cbrAddWinningAmount(
      userIds,
      amount,
      tableId,
      isRefund,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_CHECK_WALLET_BALANCE)
  async checkLudoWalletBalance(
    @MessageData()
    { userId, joinFee }: { userId: string; joinFee: string },
  ) {
    const isBalanceEnough = await this.walletUseCases.checkLudoWalletBalance(
      userId,
      joinFee,
    );
    return { isBalanceEnough };
  }

  @MessagePattern(TransporterCmds.SL_CHECK_WALLET_BALANCE)
  async checkSlWalletBalance(
    @MessageData()
    { userId, joinFee }: { userId: string; joinFee: string },
  ) {
    const isBalanceEnough = await this.walletUseCases.checkSLWalletBalance(
      userId,
      joinFee,
    );
    return { isBalanceEnough };
  }

  @MessagePattern(TransporterCmds.EPL_CHECK_WALLET_BALANCE)
  async checkEPLWalletBalance(
    @MessageData()
    { userId, joinFee }: { userId: string; joinFee: string },
  ) {
    const isBalanceEnough = await this.walletUseCases.checkEPLWalletBalance(
      userId,
      joinFee,
    );
    return { isBalanceEnough };
  }

  @MessagePattern(TransporterCmds.AVIATOR_DEBIT_BET_AMOUNT)
  async debitAviatorBetAmount(
    @MessageData()
    {
      roundNo,
      userId,
      amount,
    }: {
      roundNo: number;
      userId: string;
      amount: string;
    },
  ) {
    await this.walletUseCases.debitAviatorBetAmount(roundNo, userId, amount);
  }

  @MessagePattern(TransporterCmds.AVIATOR_CREDIT_WIN_AMOUNT)
  async creditAviatorWinningAmount(
    @MessageData()
    {
      roundNo,
      userId,
      amount,
    }: {
      roundNo: number;
      userId: string;
      amount: string;
    },
  ) {
    await this.walletUseCases.creditAviatorWinningAmount(
      roundNo,
      userId,
      amount,
    );
  }

  @MessagePattern(TransporterCmds.SL_DEBIT_JOIN_FEE)
  async debitSLJoinFee(
    @MessageData()
    {
      userIds,
      amount,
      tableId,
    }: {
      userIds: string[];
      amount: string;
      tableId: string | undefined;
    },
  ) {
    await this.walletUseCases.debitSLJoinFee(userIds, amount, tableId);
  }

  @MessagePattern(TransporterCmds.EPL_DEBIT_JOIN_FEE)
  async debitEPLJoinFee(
    @MessageData()
    {
      userIds,
      joinFee,
      tableId,
    }: {
      userIds: string[];
      joinFee: string;
      tableId: string | undefined;
    },
  ) {
    await this.walletUseCases.debitEPLJoinFee(userIds, joinFee, tableId);
  }

  @MessagePattern(TransporterCmds.SL_REFUND_JOIN_FEE)
  async refundSLJoinFee(
    @MessageData()
    {
      userIds,
      amount,
      tableId,
      isRefund,
    }: {
      userIds: string[];
      amount: string;
      tableId: string;
      isRefund: boolean;
    },
  ) {
    await this.walletUseCases.creditSLWinningAmount(
      userIds,
      amount,
      tableId,
      isRefund,
    );
  }

  @MessagePattern(TransporterCmds.SL_CREDIT_WIN_AMOUNT)
  async creditSLWinningAmount(
    @MessageData()
    {
      userIds,
      amount,
      tableId,
      isRefund,
    }: {
      userIds: string[];
      amount: string;
      tableId: string;
      isRefund: boolean;
    },
  ) {
    await this.walletUseCases.creditSLWinningAmount(
      userIds,
      amount,
      tableId,
      isRefund,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_DEBIT_JOIN_FEE)
  async debitLudoJoinFee(
    @MessageData()
    {
      userIds,
      amount,
      tableId,
      tournamentId,
    }: {
      userIds: string[];
      amount: string;
      tableId: string | undefined;
      tournamentId: string | undefined;
    },
  ) {
    await this.walletUseCases.debitLudoJoinFee(
      userIds,
      amount,
      tableId,
      tournamentId,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_CREDIT_WIN_AMOUNT)
  async creditLudoWinningAmount(
    @MessageData()
    {
      userIds,
      amount,
      tableId,
    }: {
      userIds: string[];
      amount: string;
      tableId: string;
    },
  ) {
    await this.walletUseCases.creditLudoWinningAmount(userIds, amount, tableId);
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_CREDIT_PRIZE)
  async creditLudoTournamentPrize(
    @MessageData()
    {
      tournamentId,
      prizeCredits,
    }: {
      tournamentId: string;
      prizeCredits: PrizeCredit[];
    },
  ) {
    await this.walletUseCases.creditLudoTournamentPrize(
      tournamentId,
      prizeCredits,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_REFUND)
  async refundLudoTournamentJoinFee(
    @MessageData()
    { tournamentId }: { tournamentId: string },
  ) {
    await this.walletUseCases.refundLudoTournamentJoinFee(tournamentId);
  }

  // Ludo Mega Tournament

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_DEBIT_JOIN_FEE)
  async debitLudoMegaTournamentJoinFee(
    @MessageData()
    {
      userId,
      amount,
      tournamentId,
      entryNo,
    }: {
      userId: UserID;
      amount: string;
      tournamentId: string;
      entryNo: number;
    },
  ) {
    await this.walletUseCases.debitLudoMegaTournamentJoinFee(
      userId,
      amount,
      tournamentId,
      entryNo,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_CREDIT_PRIZES)
  async creditLudoMegaTournamentPrizes(
    @MessageData()
    {
      tournamentId,
      prizes,
    }: {
      tournamentId: string;
      prizes: LudoMegaTournamentPrize[];
    },
  ) {
    await this.walletUseCases.creditLudoMegaTournamentPrizes(
      tournamentId,
      prizes,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_REFUND_JOIN_FEES)
  async refundTournamentJoinFees(
    @MessageData()
    { tournamentId }: { tournamentId: string },
  ) {
    await this.walletUseCases.refundTournamentJoinFees(tournamentId);
  }
}
