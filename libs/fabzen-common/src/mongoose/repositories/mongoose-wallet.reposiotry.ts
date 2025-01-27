import Big from 'big.js';
import * as dayjs from 'dayjs';
import { Model } from 'mongoose';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { WalletEntity } from '@lib/fabzen-common/entities/wallet.entity';
import { WalletRepository } from 'apps/wallet/src/domain/interfaces';
import {
  CreateTransactionDto,
  WalletTransactionDto,
  TransactionType,
  CalculateDeductionDto,
  HistoryParameters,
  Wallet,
  TransactionData,
  ReferralBonusDto,
  SubWallet,
  Games,
  WalletTypes,
  TxnStatus,
  UserID,
  LudoMegaTournamentPrize,
} from '@lib/fabzen-common/types';

import { User, UserDocument } from '../models/user.schema';
import {
  GameHistory,
  GameHistoryDocument,
  Payment,
  PaymentDocument,
  Transaction,
  TransactionDocument,
} from '../models';
import { WalletDto } from 'apps/wallet/src/infrastructure/controllers/dtos/wallet.transporter.dto';
import {
  ReferralHistoryDto,
  ReferralHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/promo/referral/referral.dto';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { config } from '@lib/fabzen-common/configuration';
import {
  AdminRefundRequestBody,
  BonusHistoryDto,
  BonusHistoryResponseDto,
  RefundHistoryDto,
  RefundHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/transaction/transaction.dto';
import { PrizeCredit } from 'apps/ludo-tournament/src/ludo-tournament.types';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { MongooseLudoTournamentRepository } from './mongoose-ludo-tournament.repository';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import {
  LudoTournament,
  LudoTournamentDocument,
} from '../models/ludo-tournament.schema';

@Injectable()
export class MongooseWalletRepository implements WalletRepository {
  constructor(
    @InjectModel(User.name)
    public userModel: Model<UserDocument>,
    @InjectModel(Transaction.name)
    public transactionModel: Model<TransactionDocument>,
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    @InjectModel(Payment.name)
    public paymentModel: Model<PaymentDocument>,
    @InjectModel(LudoTournament.name)
    public ludoTournamentModel: Model<LudoTournamentDocument>,
    private readonly ludoTournamentRepository: MongooseLudoTournamentRepository,
    private readonly userRepository: UserRepository,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  async getReferralHistory(
    historyParameters: HistoryParameters,
  ): Promise<ReferralHistoryResponseDto> {
    const type = TransactionType.referral;
    const { items, meta } = await this.#getTransactions(
      historyParameters,
      type,
    );
    const history: ReferralHistoryDto[] = items.map((item) => ({
      userName: item.referredUserName ?? 'Deleted User',
      amount: item.amount,
      createdAt: item._id.getTimestamp().toISOString(),
    }));

    return {
      history,
      meta,
    };
  }

  async getBonusHistory(
    historyParameters: HistoryParameters,
  ): Promise<BonusHistoryResponseDto> {
    const type = TransactionType.signupBonus;
    const { items, meta } = await this.#getTransactions(
      historyParameters,
      type,
    );
    const history: BonusHistoryDto[] = [];
    items.map((item) => {
      history.push({
        amount: item.amount,
        createdAt: item._id.getTimestamp().toISOString(),
        type: TransactionType.signupBonus,
      });
    });
    return {
      history,
      meta,
    };
  }

  async getRefundHistory(
    historyParameters: HistoryParameters,
  ): Promise<RefundHistoryResponseDto> {
    const { userId, skip, limit } = historyParameters;
    const [items, totalCount] = await Promise.all([
      this.transactionModel.find(
        {
          userId: toObjectId(userId),
          type: {
            $in: [
              TransactionType.adminRefund,
              TransactionType.ludoTournamentRefund,
            ],
          },
        },
        {},
        { skip, limit, sort: { _id: -1 } },
      ),
      this.transactionModel.countDocuments({
        userId: toObjectId(userId),
        type: {
          $in: [
            TransactionType.adminRefund,
            TransactionType.ludoTournamentRefund,
          ],
        },
      }),
    ]);
    const history: RefundHistoryDto[] = [];
    for (const item of items) {
      if (item.orderId) {
        const order = await this.paymentModel.findOne({
          orderId: item.orderId,
        });
        if (!order) {
          history.push({
            amount: item.amount,
            createdAt: item._id.getTimestamp().toISOString(),
            type: item.type,
            game: item.game,
            orderType: 'Deleted Order',
            orderId: item.orderId,
          });
          continue;
        }
        history.push({
          amount: item.amount,
          createdAt: item._id.getTimestamp().toISOString(),
          type: item.type,
          game: item.game,
          orderType: order.mode,
          orderId: item.orderId,
        });
      } else if (item.tournamentId) {
        const tournament = await this.ludoTournamentModel.findById(
          item.tournamentId,
        );
        if (!tournament) {
          history.push({
            amount: item.amount,
            createdAt: item._id.getTimestamp().toISOString(),
            type: item.type,
            game: item.game,
            tournamentId: 'Deleted LudoTournament',
            tournamentName: 'Deleted LudoTournament',
          });
          continue;
        }
        history.push({
          amount: item.amount,
          createdAt: item._id.getTimestamp().toISOString(),
          type: item.type,
          game: item.game,
          tournamentId: tournament._id.toString(),
          tournamentName: tournament.name,
        });
      } else {
        history.push({
          amount: item.amount,
          createdAt: item._id.getTimestamp().toISOString(),
          type: item.type,
          game: item.game,
        });
      }
    }
    return {
      history,
      meta: {
        totalCount,
        skip,
        limit: Math.min(totalCount, limit),
      },
    };
  }

  async getWallet(userId: string): Promise<WalletEntity | undefined> {
    const userDocument = await this.userModel.findById<UserDocument>(userId);
    return userDocument
      ? this.#convertDocumentToEntity(userDocument)
      : undefined;
  }

  #convertDocumentToEntity(userDocument: UserDocument): WalletEntity {
    const { wallet } = userDocument;
    const { main, win, bonus } = wallet;

    const walletEntity = new WalletEntity(main, win, bonus);
    return walletEntity;
  }

  async creditDepositToWallet({
    userId,
    orderId,
    amount,
  }: WalletDto): Promise<void> {
    const walletUpdateDto = {
      userId,
      amount,
      type: TransactionType.deposit,
      credit: true,
      orderId,
      portions: {
        main: 1,
        bonus: 0,
        win: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async debitPayoutFromWallet({
    userId,
    orderId,
    amount,
  }: WalletDto): Promise<void> {
    const walletUpdateDto = {
      userId,
      amount,
      type: TransactionType.withdrawal,
      credit: false,
      orderId,
      portions: {
        main: 0,
        bonus: 0,
        win: 1,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async creditPayoutRefundToWallet({
    userId,
    orderId,
    amount,
  }: WalletDto): Promise<void> {
    const walletUpdateDto = {
      userId,
      amount,
      type: TransactionType.withdrawalRefund,
      credit: true,
      orderId,
      portions: {
        main: 0,
        bonus: 0,
        win: 1,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async creditTaxRewardToWallet({
    userId,
    orderId,
    amount,
  }: WalletDto): Promise<void> {
    const walletUpdateDto = {
      userId,
      amount,
      type: TransactionType.tdsReward,
      credit: true,
      orderId,
      portions: {
        main: 1,
        bonus: 0,
        win: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async creditSignupBonus(userId: string) {
    const userDocument = await this.userModel.findById(userId, {
      signupBonus: 1,
      wallet: 1,
    });
    if (!userDocument) {
      throw new NotFoundException(`User Not Found for user ${userId}`);
    }

    const wallet = this.remoteConfigService.getSignupBonus();
    let { main, bonus } = wallet;
    const { win } = wallet;
    const userWinBalance = userDocument.wallet.win;
    if (Big(userWinBalance).lte(main)) {
      main = Big(main).sub(userWinBalance).toString();
    } else {
      bonus = Big(bonus).sub(Big(userWinBalance).sub(main)).toString();
      main = '0';
      if (Big(bonus).lt(0)) {
        bonus = '0';
      }
    }
    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        isProActive: true,
      },
    });
    if (main === '0' && win === '0' && bonus === '0') {
      return;
    }
    const totalAmount = Big(main).plus(win).plus(bonus).toString();
    const walletUpdateDto = {
      userId: userId,
      amount: totalAmount,
      type: TransactionType.signupBonus,
      credit: true,
      portions: {
        main: Big(main).div(totalAmount).toNumber(),
        bonus: Big(bonus).div(totalAmount).toNumber(),
        win: Big(win).div(totalAmount).toNumber(),
      },
      expiredAt: this.#getExpireAt(),
      expired: false,
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async spDebitJoinFee(userId: string, amount: SubWallet, tableId: string) {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }
    const { main, winning, bonus } = amount;

    const totalAmount = Big(main).plus(winning).plus(bonus).toString();

    const walletUpdateDto = {
      userId: userId,
      amount: totalAmount,
      type: TransactionType.joinFee,
      game: Games.skillpatti,
      tableId,
      credit: false,
      portions: {
        main: Big(main).div(totalAmount).toNumber(),
        bonus: Big(bonus).div(totalAmount).toNumber(),
        win: Big(winning).div(totalAmount).toNumber(),
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async reDebitJoinFee(userId: string, amount: SubWallet, tableId: string) {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }
    const { main, winning, bonus } = amount;
    const totalAmount = Big(main).plus(winning).plus(bonus).toString();
    const walletUpdateDto = {
      userId,
      amount: totalAmount,
      type: TransactionType.joinFee,
      game: Games.rummyempire,
      tableId,
      credit: false,
      portions: {
        main: Big(main).div(totalAmount).toNumber(),
        bonus: Big(bonus).div(totalAmount).toNumber(),
        win: Big(winning).div(totalAmount).toNumber(),
      },
    };

    console.log(
      `reDebitJoinFee totalAmount: ${totalAmount} main: ${main} winning: ${winning} bonus: ${bonus} TableId: ${tableId}`,
    );
    await this.#updateWallet(walletUpdateDto);
  }

  async cbrDebitJoinFee(userId: string, amount: SubWallet, tableId: string) {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }
    const { main, winning, bonus } = amount;
    const totalAmount = Big(main).plus(winning).plus(bonus).toString();
    const walletUpdateDto = {
      userId,
      amount: totalAmount,
      type: TransactionType.joinFee,
      game: Games.callbreak,
      tableId,
      credit: false,
      portions: {
        main: Big(main).div(totalAmount).toNumber(),
        bonus: Big(bonus).div(totalAmount).toNumber(),
        win: Big(winning).div(totalAmount).toNumber(),
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async debitLudoJoinFee(
    userId: string,
    amount: string,
    bonusPercentage: number,
    tableId: string | undefined,
    tournamentId: string | undefined,
  ) {
    const walletUpdateDto = {
      userId,
      amount,
      type: tableId
        ? TransactionType.joinFee
        : TransactionType.ludoTournamentJoinFee,
      game: Games.ludo,
      tableId,
      tournamentId,
      credit: false,
      portions: {
        main: 1 - bonusPercentage,
        bonus: bonusPercentage,
        win: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async debitAviatorBetAmount(
    roundNo: number,
    userId: string,
    amount: string,
    bonusPercentage: number,
  ): Promise<boolean> {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }
    const walletUpdateDto = {
      userId,
      amount,
      type: TransactionType.joinFee,
      game: Games.aviator,
      tableId: roundNo.toString(),
      credit: false,
      portions: {
        main: 1 - bonusPercentage,
        bonus: bonusPercentage,
        win: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
    return true;
  }

  async debitSLJoinFee(
    userId: string,
    amount: string,
    bonusPercentage: number,
    tableId: string | undefined,
  ) {
    const walletUpdateDto = {
      userId,
      amount,
      type: tableId ? TransactionType.joinFee : TransactionType.slGameJoinFee,
      game: Games.snakeAndLadders,
      tableId,
      credit: false,
      portions: {
        main: 1 - bonusPercentage,
        bonus: bonusPercentage,
        win: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async debitEPLJoinFee(
    userId: string,
    joinFee: string,
    bonusPercentage: number,
    tableId: string | undefined,
  ) {
    const walletUpdateDto = {
      userId,
      amount: joinFee,
      type: tableId ? TransactionType.joinFee : TransactionType.eplGameJoinFee,
      game: Games.epl,
      tableId,
      credit: false,
      portions: {
        main: 1 - bonusPercentage,
        bonus: bonusPercentage,
        win: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto).then(() =>
      console.log('UPDATE WALLET CALLED '),
    );
  }

  async creditAviatorWinningAmount(
    roundNo: number,
    userId: string,
    amount: string,
  ): Promise<void> {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }
    const walletUpdateDto = {
      userId,
      amount,
      type: TransactionType.winning,
      game: Games.aviator,
      tableId: roundNo.toString(),
      credit: true,
      portions: {
        main: 0,
        bonus: 0,
        win: 1,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async creditSLWinningAmount(
    userId: string,
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ): Promise<void> {
    const walletUpdateDto = {
      userId,
      amount,
      type: isRefund ? TransactionType.adminRefund : TransactionType.winning,
      game: Games.snakeAndLadders,
      tableId,
      credit: true,
      portions: {
        main: 0,
        win: 1,
        bonus: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async creditLudoWinningAmount(
    userId: string,
    amount: string,
    tableId: string,
  ): Promise<void> {
    const walletUpdateDto = {
      userId,
      amount,
      type: TransactionType.winning,
      game: Games.ludo,
      tableId,
      credit: true,
      portions: {
        main: 0,
        win: 1,
        bonus: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async creditLudoTournamentPrize(
    tournamentId: string,
    prizeCredits: PrizeCredit[],
  ): Promise<void> {
    const batchTransactions = [];
    const batchWalletUpdates = [];

    const userIds = prizeCredits.map(({ userId }) => userId);
    const userObjectIds = userIds.map((userId) => toObjectId(userId));

    const usersWithWallet = await this.userModel.find(
      {
        _id: {
          $in: userObjectIds,
        },
      },
      {
        wallet: 1,
      },
    );

    for (const { userId, winAmount } of prizeCredits) {
      const userWallet = usersWithWallet.find(
        (user) => user._id.toString() === userId,
      );

      if (userWallet) {
        batchTransactions.push({
          userId: toObjectId(userId),
          amount: winAmount,
          type: TransactionType.ludoTournamentPrize,
          tournamentId: toObjectId(tournamentId),
          game: Games.ludo,
          breakDown: {
            main: 0,
            win: winAmount,
            bonus: 0,
          },
        });
        const newWinningWalletAmount = Big(userWallet.wallet.win)
          .add(winAmount)
          .toString();
        batchWalletUpdates.push({
          updateOne: {
            filter: { _id: toObjectId(userId) },
            update: {
              $set: { 'wallet.win': newWinningWalletAmount },
            },
          },
        });
      }
    }
    await Promise.all([
      this.transactionModel.insertMany(batchTransactions, { ordered: false }),
      this.userModel.bulkWrite(batchWalletUpdates, { ordered: false }),
    ]);
  }

  async refundLudoTournamentJoinFee(tournamentId: string) {
    const joinFee =
      await this.ludoTournamentRepository.getTournamentJoinFee(tournamentId);
    const userIds =
      await this.ludoTournamentRepository.getTournamentUserIds(tournamentId);
    for (const userId of userIds) {
      const walletUpdateDto: WalletTransactionDto = {
        userId,
        amount: joinFee,
        type: TransactionType.ludoTournamentRefund,
        game: Games.ludo,
        tournamentId,
        credit: true,
        portions: {
          main: 1,
          win: 0,
          bonus: 0,
        },
      };
      await this.#updateWallet(walletUpdateDto);
    }
  }

  async spAddWinningAmount(
    userId: string,
    amount: SubWallet,
    tableId: string,
    isRefund?: boolean,
  ) {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }
    const { main, winning, bonus } = amount;

    const totalAmount = Big(main).plus(winning).plus(bonus).toString();

    const walletUpdateDto = {
      userId: userId,
      amount: totalAmount,
      type: isRefund ? TransactionType.adminRefund : TransactionType.winning,
      game: Games.skillpatti,
      tableId,
      credit: true,
      portions: {
        main: Big(main).div(totalAmount).toNumber(),
        bonus: Big(bonus).div(totalAmount).toNumber(),
        win: Big(winning).div(totalAmount).toNumber(),
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async reAddWinningAmount(
    userId: string,
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ) {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }

    const walletUpdateDto = {
      userId: userId,
      amount,
      type: isRefund ? TransactionType.adminRefund : TransactionType.winning,
      game: Games.rummyempire,
      tableId,
      credit: true,
      portions: {
        main: 0,
        bonus: 0,
        win: 1,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async cbrAddWinningAmount(
    userId: string,
    amount: string,
    tableId: string,
    isRefund?: boolean,
  ) {
    const wallet = await this.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }

    const walletUpdateDto = {
      userId: userId,
      amount,
      type: isRefund ? TransactionType.adminRefund : TransactionType.winning,
      game: Games.callbreak,
      tableId,
      credit: true,
      portions: {
        win: 1,
        bonus: 0,
        main: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  #getExpireAt() {
    return config.isJest
      ? dayjs().subtract(config.wallet.bonusExpirationTime, 'days')
      : dayjs().add(config.wallet.bonusExpirationTime, 'days');
  }

  async creditReferralBonus(referralBonusDto: ReferralBonusDto) {
    const { userId, referredUserId, amount } = referralBonusDto;
    const userDocument = await this.userModel.findById(userId, {
      _id: 0,
      username: 1,
      name: 1,
    });
    const referredUserName = userDocument?.name ?? userDocument?.username;
    const walletUpdateDto = {
      userId: referredUserId,
      amount,
      type: TransactionType.referral,
      credit: true,
      portions: {
        main: 1,
        bonus: 0,
        win: 0,
      },
      referredUserId: toObjectId(userId),
      referredUserName,
    };

    await this.#updateWallet(walletUpdateDto);
    await this.userModel.findByIdAndUpdate(referredUserId as string, {
      $inc: {
        'referral.earning': Big(amount).round(2).toNumber(),
      },
    });
  }

  async #updateWallet(walletUpdateDto: WalletTransactionDto) {
    const {
      portions,
      userId,
      orderId,
      type,
      amount,
      game,
      tableId,
      tournamentId,
      entryNo,
      credit,
      expiredAt,
      expired,
      referredUserId,
      referredUserName,
      transactionByUserId,
    } = walletUpdateDto;
    const mainPortion = portions?.main;
    const bonusPortion = portions?.bonus;
    const winPortion = portions?.win;

    const userDocument = await this.userModel.findById(userId, {
      wallet: 1,
      username: 1,
      name: 1,
    });

    if (!userDocument) {
      throw new NotFoundException(`Wallet Not Found for user ${userId}`);
    }

    console.log(
      `Wallet Update Log ${userId}: Transaction: ${JSON.stringify(
        walletUpdateDto,
      )}`,
    );

    if (!this.#shouldSkipDoubleTransactionCheck(walletUpdateDto)) {
      const transactionFilter: any = {
        userId: toObjectId(userId),
        orderId,
        type,
        tableId,
        tournamentId: tournamentId ? toObjectId(tournamentId) : tournamentId,
        entryNo,
      };
      const transaction =
        await this.transactionModel.findOne(transactionFilter);
      if (transaction) {
        console.log(`Wallet Update Log ${userId}: Same Transaction Exists`);
        throw new BadRequestException('Transaction already exists');
      }
    }
    const { wallet } = userDocument;
    const { main, win, bonus } = wallet;
    console.log(
      `Wallet Update Log ${userId}: Before Update: Main ${main} Win ${win} Bonus ${bonus}`,
    );
    const calculateDto = {
      main,
      win,
      bonus,
      amount,
      mainPortion,
      bonusPortion,
      winPortion,
      credit,
      type,
    };
    const {
      deductionFromBonus,
      deductionFromMain,
      deductionFromWinning,
      updatedMainBalance,
      updatedWinningBalance,
      updatedBonusBalance,
    } = this.#calculateAndUpdateBalances(calculateDto, wallet);

    console.log(
      `Wallet Update Log ${userId}: Calculated Updates: Main ${updatedMainBalance} Win ${updatedWinningBalance} Bonus ${updatedBonusBalance}`,
    );

    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        'wallet.main': updatedMainBalance,
        'wallet.win': updatedWinningBalance,
        'wallet.bonus': updatedBonusBalance,
      },
    });

    // Double Check
    const updatedUser = await this.userModel.findById(userId, {
      wallet: 1,
    });

    console.log(
      `Wallet Update Log ${userId}: After Update: Main ${updatedUser?.wallet.main} Win ${updatedUser?.wallet.win} Bonus ${updatedUser?.wallet.bonus}`,
    );

    const sign = !credit && type === TransactionType.adminRefund ? '-' : '';
    const breakDown = {
      main: sign + deductionFromMain,
      win: sign + deductionFromWinning,
      bonus: sign + deductionFromBonus,
    };

    const createTransactionDto: CreateTransactionDto = {
      userId,
      orderId,
      amount,
      type,
      game,
      tableId,
      tournamentId,
      entryNo,
      breakDown,
      referredUserId,
      referredUserName,
      transactionByUserId,
    };
    if (type === TransactionType.signupBonus) {
      createTransactionDto.expiredAt = expiredAt;
      createTransactionDto.expired = expired;
    }
    await this.#saveTransaction(createTransactionDto);

    if (
      [TransactionType.winning, TransactionType.ludoTournamentPrize].includes(
        type,
      )
    ) {
      await this.userRepository.convertToProIfEligible(userId);
    }
  }

  #calculateAndUpdateBalances(
    calculateDeductionDto: CalculateDeductionDto,
    wallet: Wallet,
  ) {
    const {
      main,
      win,
      bonus,
      amount,
      mainPortion,
      bonusPortion,
      winPortion,
      credit,
      type,
    } = calculateDeductionDto;
    let amountToUpdate = Big(amount);

    const mainFeeFraction = amountToUpdate.times(mainPortion);
    const bonusFeeFraction = amountToUpdate.times(bonusPortion);
    const winFeeFraction = amountToUpdate.times(winPortion);

    const mainBalance = Big(wallet.main);
    const winningBalance = Big(wallet.win);
    const bonusBalance = Big(wallet.bonus);

    const sign = credit ? 1 : -1;

    let deductionFromBonus = credit
      ? bonusFeeFraction.toString()
      : Big(bonus).lt(bonusFeeFraction)
        ? bonusBalance.toString()
        : bonusFeeFraction.toString();

    amountToUpdate = amountToUpdate.plus(Big(deductionFromBonus).times(sign));

    let deductionFromMain =
      credit || type === TransactionType.withdrawal
        ? mainFeeFraction.toString()
        : Big(mainBalance).lt(amountToUpdate)
          ? mainBalance.toString()
          : amountToUpdate.toString();

    let deductionFromWinning = credit
      ? winFeeFraction.toString()
      : amountToUpdate.plus(Big(deductionFromMain).times(sign)).toString();

    if (type === TransactionType.adminRefund) {
      deductionFromMain = mainFeeFraction.toString();
      deductionFromWinning = winFeeFraction.toString();
      deductionFromBonus = bonusFeeFraction.toString();
    }

    if (!credit && winningBalance.lt(deductionFromWinning)) {
      // if winningBalance round off is same then skip
      if (Big(winningBalance).sub(deductionFromWinning).round(3).eq('0')) {
        deductionFromWinning = win;
      } else {
        throw new BadRequestException('Not Enough Balance');
      }
    }

    const updatedMainBalance = Big(main)
      .plus(Big(deductionFromMain).times(sign))
      .toFixed(2);

    const updatedWinningBalance = Big(win)
      .plus(Big(deductionFromWinning).times(sign))
      .toFixed(2);

    const updatedBonusBalance = Big(bonus)
      .plus(Big(deductionFromBonus).times(sign))
      .toFixed(2);

    return {
      deductionFromBonus,
      deductionFromMain,
      deductionFromWinning,
      updatedMainBalance,
      updatedWinningBalance,
      updatedBonusBalance,
    };
  }

  async #saveTransaction(transactionDto: CreateTransactionDto) {
    const {
      userId,
      orderId,
      amount,
      game,
      tableId,
      type,
      breakDown,
      expiredAt,
      expired,
      referredUserId,
      referredUserName,
      tournamentId,
      entryNo,
      transactionByUserId,
    } = transactionDto;
    const transactionData = new this.transactionModel({
      userId: toObjectId(userId),
      orderId,
      amount,
      tableId,
      tournamentId: tournamentId ? toObjectId(tournamentId) : undefined,
      game,
      type,
      breakDown,
      expireAt: expiredAt,
      expired,
      referredUserId,
      referredUserName,
      entryNo,
      refundBy: transactionByUserId,
    });

    await transactionData.save();
  }

  #shouldSkipDoubleTransactionCheck(walletUpdateDto: WalletTransactionDto) {
    const { game, type } = walletUpdateDto;
    return (
      (game === Games.skillpatti &&
        (type === TransactionType.joinFee ||
          type === TransactionType.winning)) ||
      (game === Games.ludoMegaTournament &&
        type === TransactionType.ludoTournamentJoinFee) ||
      type === TransactionType.referral ||
      type === TransactionType.adminRefund ||
      game === Games.aviator ||
      game === Games.rummyempire
    );
  }

  async #getTransactions(
    historyParameters: HistoryParameters,
    type: TransactionType,
  ) {
    const { userId, skip, limit } = historyParameters;

    const [items, totalCount] = await Promise.all([
      this.transactionModel.find(
        { userId: toObjectId(userId), type },
        {},
        { skip, limit, sort: { _id: -1 } },
      ),
      this.transactionModel.countDocuments({
        userId: toObjectId(userId),
        type,
      }),
    ]);
    return {
      items,
      meta: {
        totalCount,
        skip,
        limit: Math.min(totalCount, limit),
      },
    };
  }

  async getExpiredBonusTransactions(userId: string) {
    const bonusTransactions = await this.transactionModel.find(
      {
        userId: toObjectId(userId),
        type: {
          $in: [TransactionType.signupBonus, TransactionType.coupon],
        },
      },
      {
        userId: 1,
        amount: 1,
        expireAt: 1,
        expired: 1,
        breakDown: 1,
        type: 1,
      },
    );

    const shouldExpiredBonusTransactions: TransactionData[] = [];
    for (const bonusTransaction of bonusTransactions) {
      const { userId, expireAt, expired } = bonusTransaction;
      if (expired) {
        continue;
      }
      const alreadyExpired = await this.#expiredBonusTransactionExists(
        String(userId),
      );
      if (alreadyExpired) {
        continue;
      }

      const isStillValid = this.#checkIfBonusIsStillValid(expireAt);
      if (isStillValid) {
        continue;
      }

      shouldExpiredBonusTransactions.push(bonusTransaction);
    }
    return shouldExpiredBonusTransactions;
  }

  async #expiredBonusTransactionExists(userId: string): Promise<boolean> {
    const expiredBonusTransaction = await this.transactionModel.findOne({
      userId: toObjectId(userId),
      expired: true,
    });
    return !!expiredBonusTransaction;
  }

  #checkIfBonusIsStillValid(
    bonusCreationTime: Date | undefined,
  ): boolean | undefined {
    return !dayjs().isAfter(dayjs(bonusCreationTime));
  }

  async processExpiredBonusTransactions(transactions: TransactionData[]) {
    for (const transaction of transactions) {
      await this.#processExpiredBonusTransaction(transaction);
    }
  }

  async #processExpiredBonusTransaction(transaction: TransactionData) {
    const { userId, amount, type, breakDown } = transaction;
    const userDocument = await this.userModel.findById<UserDocument>(userId);

    if (userDocument) {
      const { wallet } = userDocument;
      const { bonus } = wallet;
      const bonusWalletAmount = Big(bonus);
      const amountToDeduct = this.#getAmountToDeduct(
        Big(amount),
        type,
        breakDown,
      );
      const actualDeduction = bonusWalletAmount.gt(amountToDeduct)
        ? amountToDeduct
        : bonusWalletAmount;

      const bonusWalletAmountAfterExpiration = bonusWalletAmount
        .minus(actualDeduction)
        .toString();

      await this.#updateWalletAndTransaction(
        String(userId),
        bonusWalletAmountAfterExpiration,
        type,
      );
    }
  }

  #getAmountToDeduct(
    totalBonusAmount: Big,
    type: TransactionType,
    breakDown: Wallet,
  ): Big {
    return type === TransactionType.coupon
      ? totalBonusAmount
      : Big(breakDown.bonus);
  }

  async #updateWalletAndTransaction(
    userId: string,
    bonus: string,
    type: TransactionType,
  ) {
    await Promise.all([
      this.userModel.findByIdAndUpdate(userId, {
        $set: {
          'wallet.bonus': bonus,
        },
      }),
      this.transactionModel.updateMany(
        { userId: toObjectId(userId), type },
        { $set: { expired: true } },
      ),
    ]);
  }

  async adminRefund(
    adminUserId: string,
    adminRefundBody: AdminRefundRequestBody,
  ): Promise<void> {
    const { wallet, amount, orderId, tableId, game, userId, credit } =
      adminRefundBody;
    if (!orderId && !tableId) {
      throw new BadRequestException('Order Id or Table Id is required');
    }
    let refundAmount = amount;
    if (tableId) {
      const tableHistory = await this.gameHistoryModel.findOne({
        tableId,
        userId: toObjectId(userId),
      });
      if (!tableHistory) {
        throw new BadRequestException('Unable to refund the table');
      }
      refundAmount =
        game === Games.skillpatti
          ? tableHistory.startAmount
          : tableHistory.joinFee;
    }
    if (orderId) {
      const paymentHistory = await this.paymentModel.findOne({ orderId });
      if (
        !paymentHistory ||
        !paymentHistory.amount ||
        paymentHistory.status === TxnStatus.success
      ) {
        throw new BadRequestException('Unable to refund the order');
      }
      refundAmount = paymentHistory.amount;
    }
    if (!refundAmount) {
      throw new BadRequestException('Unable to refund the amount');
    }
    if (tableId || orderId) {
      const transaction = await this.transactionModel.findOne({
        tableId,
        orderId,
        type: TransactionType.adminRefund,
      });
      if (transaction) {
        throw new BadRequestException('Refund already exists');
      }
    }

    const portions = {
      main: 1,
      bonus: 0,
      win: 0,
    };
    if (wallet === WalletTypes.bonusWallet) {
      portions.bonus = 1;
      portions.main = 0;
    }
    if (wallet === WalletTypes.winningWallet) {
      portions.win = 1;
      portions.main = 0;
    }

    const walletUpdateDto: WalletTransactionDto = {
      userId,
      amount: refundAmount,
      orderId,
      type: TransactionType.adminRefund,
      credit,
      portions,
      game,
      tableId,
      transactionByUserId: adminUserId,
    };
    this.#updateWallet(walletUpdateDto);
  }

  async debitLudoMegaTournamentJoinFee(
    userId: UserID,
    amount: string,
    tournamentId: string,
    entryNo: number,
    bonusPercentage: number,
  ): Promise<void> {
    const walletUpdateDto = {
      userId,
      amount,
      type: TransactionType.ludoTournamentJoinFee,
      game: Games.ludoMegaTournament,
      tournamentId,
      entryNo,
      credit: false,
      portions: {
        main: 1 - bonusPercentage,
        bonus: bonusPercentage,
        win: 0,
      },
    };
    await this.#updateWallet(walletUpdateDto);
  }

  async convertToMain(
    userId: string,
    orderId: string,
    amount: string,
    reward: string,
  ) {
    // First Withdrawal
    await this.#updateWallet({
      userId,
      amount,
      orderId,
      type: TransactionType.withdrawal,
      credit: false,
      portions: {
        main: 0,
        bonus: 0,
        win: 1,
      },
    });

    // Then Deposit
    const amountToCredit = Big(amount).add(reward).toFixed(2);
    await this.#updateWallet({
      userId,
      amount: amountToCredit,
      orderId,
      type: TransactionType.deposit,
      credit: true,
      portions: {
        main: 1,
        bonus: 0,
        win: 0,
      },
    });
  }

  async creditLudoMegaTournamentPrizes(
    tournamentId: string,
    prizes: LudoMegaTournamentPrize[],
  ): Promise<void> {
    const tournamentObjectId = toObjectId(tournamentId);

    const batchTransactions = [];
    const batchWalletUpdates = [];
    const winAmounts: Record<string, number> = {};
    const userObjectIds = [];

    for (const { userId, winAmount } of prizes) {
      const userObjectId = toObjectId(userId);
      userObjectIds.push(userObjectId);
      if (winAmounts[userId]) {
        winAmounts[userId] += Number(winAmount);
      } else {
        winAmounts[userId] = Number(winAmount);
      }
      batchTransactions.push({
        userId: userObjectId,
        amount: winAmount,
        type: TransactionType.ludoTournamentPrize,
        tournamentId: tournamentObjectId,
        game: Games.ludoMegaTournament,
        breakDown: {
          main: '0',
          win: winAmount,
          bonus: '0',
        },
      });
    }

    const usersWithWallet = await this.userModel.find(
      {
        _id: {
          $in: userObjectIds,
        },
      },
      {
        wallet: 1,
      },
    );

    for (const userId in winAmounts) {
      const userWallet = usersWithWallet.find(
        (user) => user._id.toString() === userId,
      );

      if (userWallet) {
        const newWinningWalletAmount = Big(userWallet.wallet.win)
          .add(winAmounts[userId])
          .toFixed(2);
        batchWalletUpdates.push({
          updateOne: {
            filter: { _id: toObjectId(userId) },
            update: {
              $set: { 'wallet.win': newWinningWalletAmount },
            },
          },
        });
      }
    }

    await Promise.all([
      this.transactionModel.insertMany(batchTransactions),
      this.userModel.bulkWrite(batchWalletUpdates),
    ]);
  }

  async refundTournamentJoinFees(tournamentId: string): Promise<void> {
    const tournamentObjectId = toObjectId(tournamentId);

    const [joinFeeTransactions, firstTransactionForJoinFee] = await Promise.all(
      [
        this.transactionModel
          .find(
            {
              tournamentId: tournamentObjectId,
            },
            {
              _id: 0,
              userId: 1,
            },
          )
          .lean(),
        this.transactionModel
          .findOne(
            {
              tournamentId: tournamentObjectId,
            },
            {
              _id: 0,
              amount: 1,
            },
          )
          .lean(),
      ],
    );
    if (joinFeeTransactions.length === 0) {
      return;
    }
    const joinFee = firstTransactionForJoinFee?.amount as string;

    const batchTransactions = [];
    const batchWalletUpdates = [];
    const totalJoinFee: Record<string, number> = {};
    const userObjectIds = [];

    for (const { userId } of joinFeeTransactions) {
      userObjectIds.push(userId);
      const userIdString = userId.toString();
      if (totalJoinFee[userIdString]) {
        totalJoinFee[userIdString] += Number(joinFee);
      } else {
        totalJoinFee[userIdString] = Number(joinFee);
      }
      batchTransactions.push({
        userId,
        amount: joinFee,
        type: TransactionType.adminRefund,
        tournamentId: tournamentObjectId,
        game: Games.ludoMegaTournament,
        breakDown: {
          main: joinFee,
          win: '0',
          bonus: '0',
        },
      });
    }

    const usersWithWallet = await this.userModel.find(
      {
        _id: {
          $in: userObjectIds,
        },
      },
      {
        wallet: 1,
      },
    );

    for (const userId in totalJoinFee) {
      const userWallet = usersWithWallet.find(
        (user) => user._id.toString() === userId,
      );

      if (userWallet) {
        const newMainWalletBalance = Big(userWallet.wallet.main)
          .add(totalJoinFee[userId])
          .toFixed(2);
        batchWalletUpdates.push({
          updateOne: {
            filter: { _id: toObjectId(userId) },
            update: {
              $set: { 'wallet.main': newMainWalletBalance },
            },
          },
        });
      }
    }

    await Promise.all([
      this.transactionModel.insertMany(batchTransactions),
      this.userModel.bulkWrite(batchWalletUpdates),
    ]);
  }
}
