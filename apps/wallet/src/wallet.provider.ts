import {
  CheckWalletBalance,
  HistoryParameters,
  LudoMegaTournamentPrize,
  SubWallet,
  TransporterCmds,
  UserID,
  Wallet,
} from '@lib/fabzen-common/types';
import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { PrizeCredit } from 'apps/ludo-tournament/src/ludo-tournament.types';
import { ReferralHistoryResponseDto } from 'apps/rest-api/src/subroutes/promo/referral/referral.dto';
import { bool } from 'aws-sdk/clients/signer';

export class WalletProvider extends MicroserviceProvider {
  async getWallet(userId: string): Promise<Wallet> {
    return this._sendRequest<Wallet>(TransporterCmds.GET_WALLET, { userId });
  }

  async creditDepositToWallet(
    userId: string,
    amount: string,
    orderId: string,
  ): Promise<void> {
    return await this._sendRequest(TransporterCmds.CREDIT_DEPOSIT_TO_WALLET, {
      userId,
      amount,
      orderId,
    });
  }

  async creditPayoutRefundToWallet(
    userId: string,
    amount: string,
    orderId: string,
  ): Promise<void> {
    return await this._sendRequest(
      TransporterCmds.CREDIT_PAYOUT_REFUND_TO_WALLET,
      {
        userId,
        amount,
        orderId,
      },
    );
  }

  async creditTaxRewardToWallet(
    userId: string,
    amount: string,
    orderId: string,
  ): Promise<void> {
    return await this._sendRequest(
      TransporterCmds.CREDIT_TAX_REWARD_TO_WALLET,
      {
        userId,
        amount,
        orderId,
      },
    );
  }

  async getReferralHistory(
    historyParameters: HistoryParameters,
  ): Promise<ReferralHistoryResponseDto> {
    return await this._sendRequest(
      TransporterCmds.REFERRAL_HISTORY,
      historyParameters,
    );
  }

  async creditSignupBonus(userId: string) {
    await this._sendRequest(TransporterCmds.CREDIT_SIGNUP_BONUS, { userId });
  }

  async expireBonus(userId: string) {
    await this._sendRequest(TransporterCmds.EXPIRE_BONUS, { userId });
  }

  async creditReferralBonus(
    userId: string,
    referredUserId: string,
    amount: string,
  ) {
    await this._sendRequest(TransporterCmds.CREDIT_RERERRAL_BONUS, {
      userId,
      referredUserId,
      amount,
    });
  }

  async checkReWalletBalance(
    userId: string,
    amount: string,
  ): Promise<CheckWalletBalance> {
    return await this._sendRequest(TransporterCmds.RE_CHECK_WALLET_BALANCE, {
      userId,
      amount,
    });
  }

  async checkSpWalletBalance(
    userId: string,
    amount: string,
  ): Promise<CheckWalletBalance> {
    return await this._sendRequest(TransporterCmds.CHECK_WALLET_BALANCE, {
      userId,
      amount,
    });
  }

  async checkCbrWalletBalance(
    userId: string,
    amount: string,
  ): Promise<boolean> {
    return await this._sendRequest(TransporterCmds.CBR_CHECK_WALLET_BALANCE, {
      userId,
      amount,
    });
  }

  async joinFeeToBeDebitedForTable(
    userIds: string[],
    amounts: SubWallet[],
    tableId: string,
  ) {
    return await this._sendRequest(TransporterCmds.SP_DEBIT_JOIN_FEE, {
      userIds,
      amounts,
      tableId,
    });
  }

  async debitReJoinFee(userIds: string[], amounts: string[], tableId: string) {
    return await this._sendRequest(TransporterCmds.RE_DEBIT_JOIN_FEE, {
      userIds,
      amounts,
      tableId,
    });
  }

  async debitCbrJoinFee(userIds: string[], amount: string, tableId: string) {
    return await this._sendRequest(TransporterCmds.CBR_DEBIT_JOIN_FEE, {
      userIds,
      amount,
      tableId,
    });
  }

  async addWinningAmount(
    userIds: string[],
    amounts: SubWallet[],
    tableId: string,
    isRefund?: boolean,
  ) {
    return await this._sendRequest(TransporterCmds.SP_ADD_WINNING_AMOUNT, {
      userIds,
      amounts,
      tableId,
      isRefund,
    });
  }

  async addReWinningAmount(
    userIds: string[],
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ) {
    return await this._sendRequest(TransporterCmds.RE_ADD_WINNING_AMOUNT, {
      userIds,
      amount,
      tableId,
      isRefund,
    });
  }

  async addCbrWinningAmount(
    userIds: string[],
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ) {
    return await this._sendRequest(TransporterCmds.CBR_ADD_WINNING_AMOUNT, {
      userIds,
      amount,
      tableId,
      isRefund,
    });
  }

  async checkSLWalletBalance(
    userId: string,
    joinFee: string,
  ): Promise<boolean> {
    const { isBalanceEnough } = await this._sendRequest<{
      isBalanceEnough: boolean;
    }>(TransporterCmds.SL_CHECK_WALLET_BALANCE, {
      userId,
      joinFee,
    });
    return isBalanceEnough;
  }

  async checkEPLWalletBalance(
    userId: string,
    joinFee: string,
  ): Promise<boolean> {
    const { isBalanceEnough } = await this._sendRequest<{
      isBalanceEnough: boolean;
    }>(TransporterCmds.EPL_CHECK_WALLET_BALANCE, {
      userId,
      joinFee,
    });
    return isBalanceEnough;
  }

  async checkLudoWalletBalance(
    userId: string,
    joinFee: string,
  ): Promise<boolean> {
    const { isBalanceEnough } = await this._sendRequest<{
      isBalanceEnough: boolean;
    }>(TransporterCmds.LUDO_CHECK_WALLET_BALANCE, {
      userId,
      joinFee,
    });
    return isBalanceEnough;
  }

  async debitLudoJoinFee(userIds: string[], amount: string, tableId: string) {
    await this._sendRequest(TransporterCmds.LUDO_DEBIT_JOIN_FEE, {
      userIds,
      amount,
      tableId,
    });
  }

  async debitSLJoinFee(userIds: string[], amount: string, tableId: string) {
    await this._sendRequest(TransporterCmds.SL_DEBIT_JOIN_FEE, {
      userIds,
      amount,
      tableId,
    });
  }

  async debitEPLJoinFee(userIds: string[], joinFee: string, tableId: string) {
    await this._sendRequest(TransporterCmds.EPL_DEBIT_JOIN_FEE, {
      userIds,
      joinFee,
      tableId,
    });
  }

  async refundJoinFeeForSLGame(
    userIds: string[],
    amount: string,
    tableId: string,
    isRefund: bool,
  ) {
    await this._sendRequest(TransporterCmds.SL_REFUND_JOIN_FEE, {
      userIds,
      amount,
      tableId,
      isRefund,
    });
  }

  creditSLWinningAmount(userIds: string[], amount: string, tableId: string) {
    this._sendRequest(TransporterCmds.SL_CREDIT_WIN_AMOUNT, {
      userIds,
      amount,
      tableId,
    });
  }

  async debitLudoTournamentJoinFee(
    userIds: string[],
    amount: string,
    tournamentId: string,
  ) {
    await this._sendRequest(TransporterCmds.LUDO_DEBIT_JOIN_FEE, {
      userIds,
      amount,
      tournamentId,
    });
  }

  async debitAviatorBetAmount(roundNo: number, userId: UserID, amount: string) {
    await this._sendRequest(TransporterCmds.AVIATOR_DEBIT_BET_AMOUNT, {
      roundNo,
      userId,
      amount,
    });
  }

  async creditAviatorWinningAmount(
    roundNo: number,
    userId: UserID,
    amount: string,
  ) {
    await this._sendRequest(TransporterCmds.AVIATOR_CREDIT_WIN_AMOUNT, {
      roundNo,
      userId,
      amount,
    });
  }

  creditLudoWinningAmount(userIds: string[], amount: string, tableId: string) {
    this._sendRequest(TransporterCmds.LUDO_CREDIT_WIN_AMOUNT, {
      userIds,
      amount,
      tableId,
    });
  }

  creditLudoTournamentPrize(tournamentId: string, prizeCredits: PrizeCredit[]) {
    this._sendRequest(TransporterCmds.LUDO_TOURNAMENT_CREDIT_PRIZE, {
      tournamentId,
      prizeCredits,
    });
  }

  refundLudoTournamentFee(tournamentId: string) {
    this._sendRequest(TransporterCmds.LUDO_TOURNAMENT_REFUND, {
      tournamentId,
    });
  }

  async debitLudoMegaTournamentJoinFee(
    userId: UserID,
    amount: string,
    tournamentId: string,
    entryNo: number,
  ) {
    await this._sendRequest(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_DEBIT_JOIN_FEE,
      {
        userId,
        amount,
        tournamentId,
        entryNo,
      },
    );
  }

  async creditLudoMegaTournamentPrizes(
    tournamentId: string,
    prizes: LudoMegaTournamentPrize[],
  ): Promise<void> {
    await this._sendRequest(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_CREDIT_PRIZES,
      {
        tournamentId,
        prizes,
      },
    );
  }

  async refundTournamentJoinFees(tournamentId: string): Promise<void> {
    await this._sendRequest(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_REFUND_JOIN_FEES,
      {
        tournamentId,
      },
    );
  }
}
