import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { WalletEntity } from '@lib/fabzen-common/entities/wallet.entity';

import { WalletRepository } from '../interfaces';
import { WalletDto } from '../../infrastructure/controllers/dtos/wallet.transporter.dto';
import {
  CheckWalletBalance,
  HistoryParameters,
  LudoMegaTournamentPrize,
  SubWallet,
  UserID,
} from '@lib/fabzen-common/types';
import { ReferralHistoryResponseDto } from 'apps/rest-api/src/subroutes/promo/referral/referral.dto';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import Big from 'big.js';
import { PrizeCredit } from 'apps/ludo-tournament/src/ludo-tournament.types';

@Injectable()
export class WalletUseCases {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  async getWallet(userId: string): Promise<WalletEntity | undefined> {
    const wallet = await this.walletRepository.getWallet(userId);
    if (!wallet) {
      throw new NotFoundException(`Wallet Not Found for user ${userId}`);
    }
    return wallet;
  }

  async creditDepositToWallet({
    userId,
    amount,
    orderId,
  }: WalletDto): Promise<void> {
    await this.walletRepository.creditDepositToWallet({
      userId,
      orderId,
      amount,
    });
  }

  async debitPayoutFromWallet({
    userId,
    amount,
    orderId,
  }: WalletDto): Promise<void> {
    await this.walletRepository.debitPayoutFromWallet({
      userId,
      orderId,
      amount,
    });
  }

  async creditPayoutRefundToWallet({
    userId,
    amount,
    orderId,
  }: WalletDto): Promise<void> {
    await this.walletRepository.creditPayoutRefundToWallet({
      userId,
      orderId,
      amount,
    });
  }

  async creditTaxRewardToWallet({
    userId,
    amount,
    orderId,
  }: WalletDto): Promise<void> {
    await this.walletRepository.creditTaxRewardToWallet({
      userId,
      orderId,
      amount,
    });
  }

  async getReferralHistory(
    historyParameters: HistoryParameters,
  ): Promise<ReferralHistoryResponseDto> {
    return await this.walletRepository.getReferralHistory(historyParameters);
  }

  async creditSignupBonus(userId: string): Promise<void> {
    await this.walletRepository.creditSignupBonus(userId);
  }

  async creditReferralBonus(
    userId: string,
    referredUserId: string,
    amount: string,
  ): Promise<void> {
    await this.walletRepository.creditReferralBonus({
      userId,
      referredUserId,
      amount,
    });
  }

  async checkSpWalletBalance(
    userId: string,
    amount: string,
  ): Promise<CheckWalletBalance> {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new NotFoundException(`Wallet Not Found for user ${userId}`);
    }
    const mainBalance = Big(wallet.main);
    const winningBalance = Big(wallet.win);
    const bonusBalance = Big(wallet.bonus);

    const { bonusCommission } = this.remoteConfigService.getCommissions();
    let fee = Big(amount);
    const bonusFeeFraction = fee.times(bonusCommission).div(100);

    const deductionFromBonus = bonusBalance.lt(bonusFeeFraction)
      ? bonusBalance
      : bonusFeeFraction;
    fee = fee.minus(deductionFromBonus);

    const deductionFromMain = mainBalance.lt(fee) ? mainBalance : fee;
    fee = fee.minus(deductionFromMain);

    const deductionFromWinning = fee;

    if (fee.gte(0) && winningBalance.lt(fee)) {
      console.log('Insufficient Balance', {
        fee: fee.toString(),
        wallet,
        amount,
      });
      return {
        walletBalance: {
          main: '-1',
          winning: '-1',
          bonus: '-1',
        },
        subWallet: {
          main: deductionFromMain,
          winning: deductionFromWinning,
          bonus: deductionFromBonus,
        },
      };
    }

    const mainResidue = mainBalance.minus(deductionFromMain);
    const winningResidue = winningBalance.minus(deductionFromWinning);
    const bonusResidue = bonusBalance.minus(deductionFromBonus);

    return {
      walletBalance: {
        main: mainResidue.toString(),
        winning: winningResidue.toString(),
        bonus: bonusResidue.toString(),
      },
      subWallet: {
        main: deductionFromMain.toString(),
        winning: deductionFromWinning.toString(),
        bonus: deductionFromBonus.toString(),
      },
    };
  }

  async checkReWalletBalance(
    userId: string,
    amount: string,
  ): Promise<CheckWalletBalance> {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new NotFoundException(`Wallet Not Found for user ${userId}`);
    }
    const mainBalance = Big(wallet.main);
    const winningBalance = Big(wallet.win);
    const bonusBalance = Big(wallet.bonus);

    const { bonusCommission } = this.remoteConfigService.getCommissions();
    let fee = Big(amount);
    const bonusFeeFraction = fee.times(bonusCommission).div(100);

    const deductionFromBonus = bonusBalance.lt(bonusFeeFraction)
      ? bonusBalance
      : bonusFeeFraction;
    fee = fee.minus(deductionFromBonus);

    const deductionFromMain = mainBalance.lt(fee) ? mainBalance : fee;
    fee = fee.minus(deductionFromMain);

    const deductionFromWinning = fee;

    if (fee.gte(0) && winningBalance.lt(fee)) {
      console.log('Insufficient Balance', {
        fee: fee.toString(),
        wallet,
        amount,
      });
      return {
        walletBalance: {
          main: '-1',
          winning: '-1',
          bonus: '-1',
        },
        subWallet: {
          main: deductionFromMain,
          winning: deductionFromWinning,
          bonus: deductionFromBonus,
        },
      };
    }

    const mainResidue = mainBalance.minus(deductionFromMain);
    const winningResidue = winningBalance.minus(deductionFromWinning);
    const bonusResidue = bonusBalance.minus(deductionFromBonus);

    return {
      walletBalance: {
        main: mainResidue.toString(),
        winning: winningResidue.toString(),
        bonus: bonusResidue.toString(),
      },
      subWallet: {
        main: deductionFromMain.toString(),
        winning: deductionFromWinning.toString(),
        bonus: deductionFromBonus.toString(),
      },
    };
  }

  async checkCbrWalletBalance(
    userId: string,
    amount: string,
  ): Promise<boolean> {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new NotFoundException(`Wallet Not Found for user ${userId}`);
    }
    const mainBalance = Big(wallet.main);
    const winningBalance = Big(wallet.win);
    const bonusBalance = Big(wallet.bonus);

    const { bonusCommission } = this.remoteConfigService.getCommissions();
    let fee = Big(amount);
    const bonusFeeFraction = fee.times(bonusCommission).div(100);

    const deductionFromBonus = bonusBalance.lt(bonusFeeFraction)
      ? bonusBalance
      : bonusFeeFraction;
    fee = fee.minus(deductionFromBonus);

    const deductionFromMain = mainBalance.lt(fee) ? mainBalance : fee;
    fee = fee.minus(deductionFromMain);
    if (fee.gt(0) && winningBalance.lt(fee)) {
      return false;
    }

    return true;
  }

  async spJoinFeeToBeDebitedForTable(
    userIds: string[],
    amounts: SubWallet[],
    tableId: string,
  ) {
    await Promise.all(
      userIds.map(async (userId: string, index: number) => {
        const amount = amounts[index];
        await this.walletRepository.spDebitJoinFee(userId, amount, tableId);
      }),
    );
  }

  async reDebitJoinFee(userIds: string[], amounts: string[], tableId: string) {
    await Promise.all(
      userIds.map(async (userId: string, index: number) => {
        const wallet = await this.checkReWalletBalance(userId, amounts[index]);
        console.log(
          `wallet deduction amount ${wallet.subWallet} TableId: ${tableId}`,
        );
        await this.walletRepository.reDebitJoinFee(
          userId,
          wallet.subWallet,
          tableId,
        );
      }),
    );
  }

  async cbrDebitJoinFee(userIds: string[], amount: string, tableId: string) {
    await Promise.all(
      userIds.map(async (userId: string) => {
        const wallet = await this.checkSpWalletBalance(userId, amount);
        await this.walletRepository.cbrDebitJoinFee(
          userId,
          wallet.subWallet,
          tableId,
        );
      }),
    );
  }

  async spAddWinningAmount(
    userIds: string[],
    amounts: SubWallet[],
    tableId: string,
    isRefund?: boolean,
  ) {
    await Promise.all(
      userIds.map(async (userId: string, index: number) => {
        const amount = amounts[index];
        await this.walletRepository.spAddWinningAmount(
          userId,
          amount,
          tableId,
          isRefund,
        );
      }),
    );
  }

  async reAddWinningAmount(
    userIds: string[],
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ) {
    await Promise.all(
      userIds.map(async (userId: string) => {
        await this.walletRepository.reAddWinningAmount(
          userId,
          amount,
          tableId,
          isRefund,
        );
      }),
    );
  }

  async cbrAddWinningAmount(
    userIds: string[],
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ) {
    await Promise.all(
      userIds.map(async (userId: string) => {
        await this.walletRepository.cbrAddWinningAmount(
          userId,
          amount,
          tableId,
          isRefund,
        );
      }),
    );
  }

  async checkLudoWalletBalance(
    userId: string,
    joinFee: string,
  ): Promise<boolean> {
    const wallet = await this.walletRepository.getWallet(userId);
    if (!wallet) {
      throw new InternalServerErrorException(`User ${userId} has no wallet`);
    }
    const mainBalance = Big(wallet.main);
    const winningBalance = Big(wallet.win);
    const bonusBalance = Big(wallet.bonus);

    const bonusCommission =
      this.remoteConfigService.getCommissions().bonusCommission;
    let fee = Big(joinFee);
    const bonusFeeFraction = fee.times(bonusCommission).div(100);

    const deductionFromBonus = bonusBalance.lt(bonusFeeFraction)
      ? bonusBalance
      : bonusFeeFraction;
    fee = fee.minus(deductionFromBonus);

    const deductionFromMain = mainBalance.lt(fee) ? mainBalance : fee;
    fee = fee.minus(deductionFromMain);

    if (fee.gt(0) && winningBalance.lt(fee)) {
      return false;
    }
    return true;
  }

  async checkSLWalletBalance(
    userId: string,
    joinFee: string,
  ): Promise<boolean> {
    const wallet = await this.walletRepository.getWallet(userId);
    if (!wallet) {
      throw new InternalServerErrorException(`User ${userId} has no wallet`);
    }
    const mainBalance = Big(wallet.main);
    const winningBalance = Big(wallet.win);
    const bonusBalance = Big(wallet.bonus);

    const bonusCommission =
      this.remoteConfigService.getCommissions().bonusCommission;
    let fee = Big(joinFee);
    const bonusFeeFraction = fee.times(bonusCommission).div(100);

    const deductionFromBonus = bonusBalance.lt(bonusFeeFraction)
      ? bonusBalance
      : bonusFeeFraction;
    fee = fee.minus(deductionFromBonus);

    const deductionFromMain = mainBalance.lt(fee) ? mainBalance : fee;
    fee = fee.minus(deductionFromMain);

    if (fee.gt(0) && winningBalance.lt(fee)) {
      return false;
    }
    return true;
  }

  async checkEPLWalletBalance(
    userId: string,
    joinFee: string,
  ): Promise<boolean> {
    const wallet = await this.walletRepository.getWallet(userId);
    if (!wallet) {
      throw new InternalServerErrorException(`User ${userId} has no wallet`);
    }
    const mainBalance = Big(wallet.main);
    const winningBalance = Big(wallet.win);
    const bonusBalance = Big(wallet.bonus);

    const bonusCommission =
      this.remoteConfigService.getCommissions().bonusCommission;
    let fee = Big(joinFee);
    const bonusFeeFraction = fee.times(bonusCommission).div(100);

    const deductionFromBonus = bonusBalance.lt(bonusFeeFraction)
      ? bonusBalance
      : bonusFeeFraction;
    fee = fee.minus(deductionFromBonus);

    const deductionFromMain = mainBalance.lt(fee) ? mainBalance : fee;
    fee = fee.minus(deductionFromMain);

    if (fee.gt(0) && winningBalance.lt(fee)) {
      throw new BadRequestException(
        `User ${userId} has insufficient wallet balance`,
      );
    }
    return true;
  }

  async debitAviatorBetAmount(roundNo: number, userId: string, amount: string) {
    const bonusCommission =
      this.remoteConfigService.getCommissions().bonusCommission;
    const bonusPercentage = Big(bonusCommission).div(100).toNumber();
    await this.walletRepository.debitAviatorBetAmount(
      roundNo,
      userId,
      amount,
      bonusPercentage,
    );
  }

  async creditAviatorWinningAmount(
    roundNo: number,
    userId: string,
    amount: string,
  ) {
    await this.walletRepository.creditAviatorWinningAmount(
      roundNo,
      userId,
      amount,
    );
  }

  async debitSLJoinFee(
    userIds: string[],
    amount: string,
    tableId: string | undefined,
  ) {
    const bonusCommission =
      this.remoteConfigService.getCommissions().bonusCommission;
    const bonusPercentage = Big(bonusCommission).div(100).toNumber();
    await Promise.all(
      userIds.map((userId) =>
        this.walletRepository.debitSLJoinFee(
          userId,
          amount,
          bonusPercentage,
          tableId,
        ),
      ),
    );
  }

  async debitEPLJoinFee(
    userIds: string[],
    joinFee: string,
    tableId: string | undefined,
  ) {
    const bonusCommission =
      this.remoteConfigService.getCommissions().bonusCommission;
    const bonusPercentage = Big(bonusCommission).div(100).toNumber();
    await Promise.all(
      userIds.map((userId) =>
        this.walletRepository.debitEPLJoinFee(
          userId,
          joinFee,
          bonusPercentage,
          tableId,
        ),
      ),
    );
  }

  async creditSLWinningAmount(
    userIds: string[],
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ) {
    await Promise.all(
      userIds.map((userId) =>
        this.walletRepository.creditSLWinningAmount(
          userId,
          amount,
          tableId,
          isRefund,
        ),
      ),
    );
  }

  async debitLudoJoinFee(
    userIds: string[],
    amount: string,
    tableId: string | undefined,
    tournamentId: string | undefined,
  ) {
    const bonusCommission =
      this.remoteConfigService.getCommissions().bonusCommission;
    const bonusPercentage = Big(bonusCommission).div(100).toNumber();
    await Promise.all(
      userIds.map((userId) =>
        this.walletRepository.debitLudoJoinFee(
          userId,
          amount,
          bonusPercentage,
          tableId,
          tournamentId,
        ),
      ),
    );
  }

  async creditLudoWinningAmount(
    userIds: string[],
    amount: string,
    tableId: string,
  ) {
    await Promise.all(
      userIds.map((userId) =>
        this.walletRepository.creditLudoWinningAmount(userId, amount, tableId),
      ),
    );
  }

  async creditLudoTournamentPrize(
    tournamentId: string,
    prizeCredits: PrizeCredit[],
  ) {
    this.walletRepository.creditLudoTournamentPrize(tournamentId, prizeCredits);
  }

  async refundLudoTournamentJoinFee(tournamentId: string) {
    this.walletRepository.refundLudoTournamentJoinFee(tournamentId);
  }

  async expiredBonus(userId: string) {
    const expiredBonusTransactions =
      await this.walletRepository.getExpiredBonusTransactions(userId);
    await this.walletRepository.processExpiredBonusTransactions(
      expiredBonusTransactions,
    );
  }

  async debitLudoMegaTournamentJoinFee(
    userId: UserID,
    amount: string,
    tournamentId: string,
    entryNo: number,
  ) {
    const bonusCommission =
      this.remoteConfigService.getCommissions().bonusCommission;
    const bonusPercentage = Big(bonusCommission).div(100).toNumber();
    await this.walletRepository.debitLudoMegaTournamentJoinFee(
      userId,
      amount,
      tournamentId,
      entryNo,
      bonusPercentage,
    );
  }

  async creditLudoMegaTournamentPrizes(
    tournamentId: string,
    prizes: LudoMegaTournamentPrize[],
  ) {
    await this.walletRepository.creditLudoMegaTournamentPrizes(
      tournamentId,
      prizes,
    );
  }

  async refundTournamentJoinFees(tournamentId: string) {
    await this.walletRepository.refundTournamentJoinFees(tournamentId);
  }
}
