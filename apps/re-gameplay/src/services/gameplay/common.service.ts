/* eslint-disable @typescript-eslint/no-unused-vars */
import Big from 'big.js';
import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';

import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import {
  Table,
  PlayerId,
  Card,
  WinnerCompareInfo,
  CardsCategory,
  CompareResult,
  PlayerCardsInfo,
  SideShowCardsInfo,
  SideShowInfo,
  PlayerEndInfo,
  GameEndInfo,
  PlayerGameInfo,
  TableWithPid,
  SubWallet,
  GameOutcome,
  CheckWalletBalance,
  GameStatus,
  PlayerCards,
  WinnerAmount,
  UserID,
  UserQueueData,
  TransporterProviders,
  Games,
} from '@lib/fabzen-common/types';

import { TableService } from './table.service';
import { RedisTransientDBService } from '../transient-db/redis-backend';
import { ReGameplayGateway } from '../../re-gameplay.gateway';
import {
  calculateScore,
  getRePlayerId,
  leaveLogs,
} from '../../utils/re-gameplay.utils';
import * as AWS from 'aws-sdk';
import { config } from '@lib/fabzen-common/configuration';
import { RedisService } from '../transient-db/redis/service';
import { ClientProxy } from '@nestjs/microservices';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { UserProvider } from 'apps/user/src/user.provider';
import { ReGameHistoryRepository } from '../../re-gameplay.repository';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import {
  DefaultGroupNumber,
  PlayerInfo,
  ReCard,
  ReCardsGroup,
  ReDealCardsResponse,
  ReGameEndInfo,
  ReGameOutcome,
  ReGameStatus,
  ReGroupState,
  RePlayerId,
  ReTable,
  ReTableWithPid,
  ReUserInfo,
  Status,
} from '../../re-gameplay.types';
import * as dayjs from 'dayjs';

@Injectable()
export class CommonService {
  private readonly walletProvider: WalletProvider;
  private readonly userProvider: UserProvider;
  constructor(
    @Inject(forwardRef(() => TableService)) private tableService: TableService,
    @Inject(forwardRef(() => ReGameplayGateway))
    private readonly reGameplayGateway: ReGameplayGateway,
    private redisService: RedisService,
    private readonly transientDBService: RedisTransientDBService,
    private readonly userRepository: UserRepository,
    private readonly remoteConfigService: RemoteConfigService,
    @Inject(TransporterProviders.WALLET_SERVICE)
    private walletClient: ClientProxy,
    @Inject(TransporterProviders.USER_SERVICE)
    private userClient: ClientProxy,
    private reGameHistoryRepository: ReGameHistoryRepository,
  ) {
    this.walletProvider = new WalletProvider(this.walletClient);
    this.userProvider = new UserProvider(this.userClient);
  }

  /**
   * Get User Name and Profile Pictures from User Service
   */
  private async getUserNameProfilePicList(userIds: string[]) {
    return await this.userProvider.getUserNameProfilePicList(userIds);
  }

  /**
   * Insert User to table
   */
  async joinExistingReTable(users: UserQueueData[], tableId: string) {
    leaveLogs('RE joinExistingTable create', { tableId, users });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('RE joinExistingTable lock', { tableId, pid });

    try {
      const playerId = (await this.getNextEmptyRePlayerId(table)) as RePlayerId;
      const playerIds = new Set(table.players.map((player) => player.playerId));
      const emptyPlayerIds = config.reGameplay.playerOrder.filter(
        (id) => !playerIds.has(id as RePlayerId),
      );

      // debit join amount from the player
      const userIds = users.map((player) => player.userId);
      const amounts = users.map((player) => player.amount);

      if (!playerId) {
        throw new BadRequestException('Table is full');
      }

      const newPlayers = users.map((user, index) => {
        const startAmount: string = Big(this.getSubWalletSum(user.amount))
          .plus(this.getSubWalletSum(user.walletBalance))
          .toString();

        const active: boolean =
          table.gameStatus === ReGameStatus.waiting ||
          table.gameStatus === ReGameStatus.roundStarted
            ? true
            : false;
        const late: boolean =
          table.gameStatus === ReGameStatus.waiting ||
          table.gameStatus === ReGameStatus.roundStarted
            ? false
            : true;

        return {
          userId: user.userId,
          playerId: emptyPlayerIds[index] as RePlayerId,
          active,
          late,
          isDrawn: false,
          isDiscarded: false,
          declare: false,
          isFirstDeclared: false,
          isDecValid: true,
          turnNo: 0,
          drop: false,
          softDrop: false,
          score: '0',
          startAmount,
        };
      }) as PlayerInfo[];

      for (const newPlayer of newPlayers) {
        newPlayer.playerInfo = await this.userRepository.getUserGameDetails(
          newPlayer.userId,
          Games.rummyempire,
        );
      }
      table.players.push(...newPlayers);

      let noLatePlayers: number = 0;
      newPlayers.map((player) => {
        if (player.late) {
          noLatePlayers++;
        }
      });
      table.declaredNo += noLatePlayers;

      table.joinNo += newPlayers.length;

      await this.tableService.updateReTable(table, pid);
      leaveLogs('RE joinExistingTable unlock', {
        tableId: table.tableId,
        pid,
      });

      await Promise.all([
        ...users.map((user) =>
          this.transientDBService.setUserActiveTableId(
            user.userId,
            table.tableId,
          ),
        ),
        ...newPlayers.map((newPlayer) =>
          this.reGameplayGateway.joinExistingReTable(table, newPlayer),
        ),
        // this.debitTable(userIds, amounts, tableId),
        // for online user count
        this.reGameplayGateway.handleReJoinUser(table.tableType, users.length),
      ]);
      leaveLogs('RE join existing table', { newPlayers, tableId });

      if (
        table.gameStatus === ReGameStatus.waiting &&
        table.players.length === 6
      ) {
        await this.reGameplayGateway.startReRound(table.tableId);
      }
    } catch (error) {
      console.log(JSON.stringify(error), error.message);
      throw new Error(error);
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      // this.logger.log('joinExistingTable final unlock', { tableId, pid });
    }
  }

  getSortedCards(cardsArray: string[]): ReCardsGroup[] {
    const cardsBySuit: { [key: string]: string[] } = {
      H: [],
      D: [],
      C: [],
      S: [],
    };
    const cdRedJoker: string = ReCard.cdRedJoker;
    const cdBlackJoker: string = ReCard.cdBlackJoker;

    // remove Joker cards from card groups
    const idsOfJoker: number[] = [];
    const jokerCards: string[] = [];
    for (const [index, card] of cardsArray.entries()) {
      const suitNumber = `${card.split(',')[1]}${card.split(',')[2]}`;
      console.log('DealCard suitNumber', suitNumber);
      if (suitNumber === cdRedJoker || suitNumber === cdBlackJoker) {
        idsOfJoker.push(index);
        jokerCards.push(card);
      }
    }
    for (const element of idsOfJoker) {
      cardsArray.splice(element, 1);
    }

    for (const card of cardsArray) {
      const [deck, suit, number] = card.split(',');
      cardsBySuit[suit].push(card);
    }

    const cardsDefaultGroups: ReCardsGroup[] = Object.entries(cardsBySuit).map(
      ([suit, cards]) => {
        return {
          cards,
          groupState: undefined,
          valid: false,
        };
      },
    );

    if (jokerCards.length > 0) {
      cardsDefaultGroups.push({
        cards: jokerCards,
        groupState: undefined,
        valid: false,
      });
    }

    return cardsDefaultGroups;
  }

  async addWinningAmount(table: Table) {
    const player = table.players[0];
    const gameCommission =
      this.remoteConfigService.getSpCommissionsByUsers()[
        `${table.roundStartPlayersNo}`
      ] ?? '10';
    const commissionAmount = Big(table.potAmount)
      .mul(gameCommission)
      .div(100)
      .toString();
    if (player.active || player.allin) {
      player.amount.winning = Big(player.amount.winning)
        .plus(Big(table.potAmount).mul(Big(100).sub(gameCommission)).div(100))
        .toString();
    }

    this.walletProvider.addWinningAmount(
      [player.userId],
      [player.amount],
      table.tableId,
    );

    this.reGameHistoryRepository.createTableHistory({
      userId: toObjectId(player.userId),
      tableId: table.tableId,
      startAmount: player.startAmount,
      endAmount: this.getSubWalletSum(player.amount),
      tableType: table.tableType,
    });

    if (table.potAmount === '0') {
      return;
    }

    // Round History
    const tablePlayer = table.players[0];
    const userInfo = {
      userId: toObjectId(tablePlayer.userId),
      username: tablePlayer.playerInfo.username,
      avatar: tablePlayer.playerInfo.avatar,
      winLossAmount: (tablePlayer.active || tablePlayer.allin
        ? Big(table.potAmount).mul(Big(100).sub(gameCommission)).div(100)
        : Big('0')
      )
        .minus(Big(tablePlayer.betAmount))
        .toString(),
      outcome: GameOutcome.won,
      betAmount: tablePlayer.betAmount,
      playerAmount: this.getSubWalletSum(tablePlayer.amount),
      handCards: tablePlayer.firstCard
        ? [
            tablePlayer.firstCard as Card,
            ...(tablePlayer.hiddenCards as [Card, Card]),
          ]
        : [],
      status: tablePlayer.active
        ? 'active'
        : tablePlayer.allin
          ? 'allin'
          : 'inactive',
    };

    this.reGameHistoryRepository.createRoundHistory({
      tableId: table.tableId,
      tableType: table.tableType,
      roundNo: table.roundNo,
      commissionAmount,
      tableCard: table?.commonCard,
      winners: [tablePlayer.userId],
      userInfo: [userInfo],
      potAmount: table.potAmount,
      roundStartedAt: table.roundStartedAt,
    });
  }

  async checkIfJoined(userId: string) {
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    if (!tableId) {
      return false;
    }
    const table = (await this.transientDBService.getActiveReTable(
      tableId,
    )) as ReTable;
    return table.players.findIndex((player) => player.userId === userId) !== -1;
  }

  // debit initialBet to players who have not submitted buyInRes before force start
  async debitTable(userIds: string[], amounts: SubWallet[], tableId: string) {
    await this.walletProvider.joinFeeToBeDebitedForTable(
      userIds,
      amounts,
      tableId,
    );
  }

  // Deduct money from player's wallet
  async debitReTable(userIds: string[], amounts: string[], tableId: string) {
    await this.walletProvider.debitReJoinFee(userIds, amounts, tableId);
  }

  // TODO: updateReferralAmount sqs
  async updateReferralAmount(table: Table) {
    for (const player of table.players) {
      // await this.sqs.sendEvent({
      //   channel: Channel.spGameplay,
      //   op: "updateReferredAmount",
      //   event: {
      //     referredUser: player.userId,
      //     amount: "0",
      //     totalMatches: 1,
      //   },
      //   corId: nanoid(9),
      //   user: { _id: player.userId, roles: [Role.player] },
      // });
    }
  }

  async getNextEmptyPlayerId(table: Table) {
    const playerIds = table.players.map(
      (player) => player.playerId,
    ) as string[];
    return config.spGameplay.playerOrder.find(
      (item) => !playerIds.includes(item),
    );
  }

  async getNextEmptyRePlayerId(table: ReTable) {
    const playerIds = table.players.map(
      (player) => player.playerId,
    ) as string[];
    return config.reGameplay.playerOrder.find(
      (item) => !playerIds.includes(item),
    );
  }

  async checkWalletBalance(
    userId: UserID,
    amount: string,
  ): Promise<CheckWalletBalance> {
    return await this.walletProvider.checkReWalletBalance(userId, amount);
  }

  checkRebuyWalletBalance(balance: SubWallet, amount: string) {
    const mainBalance = Big(balance.main);
    const winningBalance = Big(balance.winning);
    const bonusBalance = Big(balance.bonus);
    let walletBalance = '0';

    let fee = Big(amount);

    const commissions = this.remoteConfigService.getCommissions();
    const bonusCommission = commissions.bonusCommission;
    const restCommission = Big(100).minus(bonusCommission);

    const bonusFeeFraction = fee.times(bonusCommission).div(100); // 5% of the total fee will be deducted from Bonus Wallet
    const deductionFromBonus = bonusBalance.lt(bonusFeeFraction)
      ? bonusBalance
      : bonusFeeFraction;
    fee = fee.minus(deductionFromBonus);

    const deductionFromMain = mainBalance.lt(fee) ? mainBalance : fee;
    fee = fee.minus(deductionFromMain);

    const deductionFromWinning = fee;

    if (fee.gt(0) && winningBalance.lt(fee)) {
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
    const mainPlusWinning = mainResidue.plus(winningResidue);

    walletBalance = mainPlusWinning
      .mul(bonusCommission)
      .div(restCommission)
      .gt(bonusResidue)
      ? mainPlusWinning.plus(bonusResidue).toFixed(2, 0)
      : mainPlusWinning.mul(100).div(restCommission).toFixed(2, 0);

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

  getSubWalletBalance(amount: SubWallet): Big {
    const commissions = this.remoteConfigService.getCommissions();
    const bonusCommission = commissions.bonusCommission;
    const restCommission = Big(100).minus(bonusCommission);

    const mainBalance = Big(amount.main);
    const winningBalance = Big(amount.winning);
    const mainPlusWinning = mainBalance.plus(winningBalance);
    const bonusBalance = Big(amount.bonus);
    const balance = mainPlusWinning
      .mul(bonusCommission)
      .div(restCommission)
      .gte(bonusBalance)
      ? mainPlusWinning.plus(bonusBalance)
      : mainPlusWinning.mul(100).div(restCommission);
    return balance;
  }

  debitSubWallet(playerAmount: SubWallet, amount: string): SubWallet {
    const mainBalance = Big(playerAmount.main);
    const winningBalance = Big(playerAmount.winning);
    const bonusBalance = Big(playerAmount.bonus);
    let fee = Big(amount);
    const commissions = this.remoteConfigService.getCommissions();
    const bonusCommission = commissions.bonusCommission;
    const restCommission = Big(100).minus(bonusCommission);

    const bonusFeeFraction = fee.times(bonusCommission).div(100); // 5% of the total fee will be deducted from Bonus Wallet

    const deductionFromBonus = bonusBalance.lt(bonusFeeFraction)
      ? bonusBalance
      : bonusFeeFraction;
    fee = fee.minus(deductionFromBonus);

    const deductionFromMain = mainBalance.lt(fee) ? mainBalance : fee;
    fee = fee.minus(deductionFromMain);

    if (fee.gt(0) && winningBalance.lt(fee)) {
      throw new BadRequestException('Insufficient Balance');
    }

    const deductionFromWinning = fee;

    playerAmount.main = mainBalance.minus(deductionFromMain).toString();
    playerAmount.winning = winningBalance
      .minus(deductionFromWinning)
      .toString();
    playerAmount.bonus = bonusBalance.minus(deductionFromBonus).toString();

    return playerAmount;
  }

  // create round history when round ended
  async createRoundHistory(table: Table) {
    const response = await this.gameEnd(table);

    // create round history
    const userInfo = table.players
      .filter((tablePlayer) => tablePlayer.betAmount !== '0')
      .map((tablePlayer) => {
        const player = response.playersEndInfo.find(
          (item) => item.playerId === tablePlayer.playerId,
        ) as PlayerEndInfo;
        if (player) {
          const winLossAmount = Big(player.playerAmount)
            .minus(Big(tablePlayer.roundAmount))
            .toString();
          const outcome = Big(winLossAmount).gte(Big('0'))
            ? GameOutcome.won
            : GameOutcome.lost;
          return {
            userId: toObjectId(tablePlayer.userId),
            username: tablePlayer.playerInfo.username,
            avatar: tablePlayer.playerInfo.avatar,
            winLossAmount,
            outcome,
            betAmount: tablePlayer.betAmount,
            handCards: player.handCards,
            playerCardsInfo: player.playerCardsInfo,
            playerAmount: player.playerAmount,
            status: tablePlayer.active
              ? 'active'
              : tablePlayer.allin
                ? 'allin'
                : 'pack',
          };
        } else {
          return {
            userId: toObjectId(tablePlayer.userId),
            username: tablePlayer.playerInfo.username,
            avatar: tablePlayer.playerInfo.avatar,
            winLossAmount: Big('0')
              .minus(Big(tablePlayer.betAmount))
              .toString(),
            outcome: GameOutcome.lost,
            betAmount: tablePlayer.betAmount,
            handCards: tablePlayer.firstCard
              ? [
                  tablePlayer?.firstCard,
                  ...(tablePlayer?.hiddenCards as [Card, Card]),
                ]
              : undefined,
            playerCardsInfo: tablePlayer.firstCard
              ? this.getPlayerCardsInfo([
                  tablePlayer?.firstCard as Card,
                  ...(tablePlayer?.hiddenCards as [Card, Card]),
                  table?.commonCard as Card,
                ])
              : undefined,
            playerAmount: this.getSubWalletSum(tablePlayer.amount),
            status: tablePlayer.active
              ? 'active'
              : tablePlayer.allin
                ? 'allin'
                : 'pack',
          };
        }
      });

    const winners: string[] = [];
    response.winners.map((winner) => {
      const playerIndex = table.players.findIndex(
        (player) => player.playerId === winner,
      );
      winners.push(table.players[playerIndex].playerInfo.username);
    });

    this.reGameHistoryRepository.createRoundHistory({
      tableId: table.tableId,
      tableType: table.tableType,
      roundNo: table.roundNo,
      commissionAmount: response.commissionAmount,
      winners,
      userInfo,
      potAmount: table.potAmount,
      tableCard: table?.commonCard,
      roundStartedAt: table.roundStartedAt,
    });
  }

  // create round history when round ended
  async createReRoundHistory(table: ReTable) {
    const result = await this.getRoundResult(table);

    // create round history
    const userIds: string[] = [];
    const amounts: string[] = [];
    const userInfo: any[] = [];
    await Promise.all(
      result.table.players.map(async (tablePlayer) => {
        if (tablePlayer.userId === result.winner) {
          const winLossAmount = result.winningAmount;
          const outcome = GameOutcome.won;

          // Add winningAmount to winner
          console.log(
            `addReWinningAmount start winningAmount: ${result.winningAmount} TableId: ${table.tableId} RoundId: ${table.roundId}`,
          );
          if (result.winningAmount !== '0') {
            await this.walletProvider.addReWinningAmount(
              [tablePlayer.userId],
              result.winningAmount,
              table.tableId,
            );
          }
          console.log(`addReWinningAmount end TableId: ${table.tableId} RoundId: ${table.roundId}`);

          userInfo.push({
            userId: toObjectId(tablePlayer.userId),
            username: tablePlayer.playerInfo.username,
            avatar: tablePlayer.playerInfo.avatar,
            handCards: tablePlayer.cardsGroups,
            status: Status.active,
            score: tablePlayer.score,
            winLossAmount,
            outcome,
          });
        } else {
          if (!tablePlayer.late) {
            const winLossAmount = Big(tablePlayer.score)
              .mul(Big(result.tableType.pointValue))
              .toString();

            if (result.winningAmount !== '0' && tablePlayer.score !== '0') {
              userIds.push(tablePlayer.userId);
              amounts.push(winLossAmount);
            }

            const status = tablePlayer.softDrop ? Status.drop : Status.active;

            userInfo.push({
              userId: toObjectId(tablePlayer.userId),
              username: tablePlayer.playerInfo.username,
              avatar: tablePlayer.playerInfo.avatar,
              handCards: tablePlayer.cardsGroups,
              status,
              score: tablePlayer.score,
              winLossAmount,
              outcome: GameOutcome.lost,
            });
          }
        }
      }),
    );

    console.log(
      `userInfo active players: ${userInfo} TableId: ${table.tableId} RoundId: ${table.roundId}`,
    );

    await Promise.all(
      result.table.leftPlayers.map((leftPlayer) => {
        const winLossAmount = Big(leftPlayer.score)
          .mul(Big(result.tableType.pointValue))
          .toString();

        userInfo.push({
          userId: toObjectId(leftPlayer.userId),
          username: leftPlayer.playerInfo.username,
          avatar: leftPlayer.playerInfo.avatar,
          handCards: leftPlayer.cardsGroups,
          status: Status.leave,
          score: leftPlayer.score,
          winLossAmount,
          outcome: GameOutcome.lost,
        });
      }),
    );

    console.log(`userInfo all players: ${userInfo} TableId: ${table.tableId} RoundId: ${table.roundId}`);

    console.log(`debitReJoinFee start TableId: ${table.tableId} RoundId: ${table.roundId}`);
    await this.walletProvider.debitReJoinFee(userIds, amounts, table.tableId);
    console.log(`debitReJoinFee end TableId: ${table.tableId} RoundId: ${table.roundId}`);

    if (!table.wildCard) {
      throw new BadRequestException('Wild Card Data is missing in the table');
    }

    console.log(`createReRoundHistory start TableId: ${table.tableId} RoundId: ${table.roundId}`);
    await this.reGameHistoryRepository.createReRoundHistory({
      tableId: table.tableId,
      tableType: result.tableType,
      joinFee: Big(result.tableType.pointValue).mul(Big('80')).toString(),
      roundId: table.roundId,
      commissionAmount: result.commissionAmount,
      winner: result.winner,
      wildCard: table.wildCard,
      userInfo: userInfo as ReUserInfo[],
      roundStartedAt: table.roundStartedAt,
    });
    console.log(`createReRoundHistory end TableId: ${table.tableId} RoundId: ${table.roundId}`);
  }

  // create round history for left user
  async createLeftUserRoundHistory(table: Table, userId: string) {
    const players = table.players;
    const playerIndex = players.findIndex((player) => player.userId === userId);
    const tablePlayer = players[playerIndex];

    const userInfo = {
      userId: toObjectId(tablePlayer.userId),
      username: tablePlayer.playerInfo.username,
      avatar: tablePlayer.playerInfo.avatar,
      winLossAmount: Big('0').minus(Big(tablePlayer.betAmount)).toString(),
      outcome: GameOutcome.lost,
      betAmount: tablePlayer.betAmount,
      handCards: tablePlayer.firstCard
        ? [
            tablePlayer?.firstCard,
            ...(tablePlayer?.hiddenCards as [Card, Card]),
          ]
        : undefined,
      playerAmount: this.getSubWalletSum(tablePlayer.amount),
      status: 'leftTable',
    };

    this.reGameHistoryRepository.createRoundHistory({
      tableId: table.tableId,
      tableType: table.tableType,
      roundNo: table.roundNo,
      winners: [],
      userInfo: [userInfo],
      potAmount: table.potAmount,
      tableCard: table?.commonCard,
      roundStartedAt: table.roundStartedAt,
    });
  }

  // create round history for left user
  async createLeftUserTableHistory(
    table: Table,
    userId: string,
    stuckLeave?: boolean,
  ) {
    const players = table.players;
    const playerIndex = players.findIndex((player) => player.userId === userId);

    this.walletProvider.addWinningAmount(
      [userId],
      [players[playerIndex].amount],
      table.tableId,
    );

    this.reGameHistoryRepository.createTableHistory({
      userId: toObjectId(userId),
      tableId: table.tableId,
      startAmount: players[playerIndex].startAmount,
      endAmount: this.getSubWalletSum(players[playerIndex].amount),
      tableType: table.tableType,
    });
  }

  async createReLeftUserTableHistory(
    table: ReTable,
    userId: string,
    stuckLeave?: boolean,
  ) {
    const players = table.players;
    const playerIndex = players.findIndex((player) => player.userId === userId);
    const { main, win, bonus } = await this.walletProvider.getWallet(userId);
    const endAmount = Big(main).plus(Big(win)).plus(Big(bonus)).toString();

    this.reGameHistoryRepository.createReTableHistory({
      userId: toObjectId(userId),
      tableId: table.tableId,
      joinFee: Big(table.tableType.pointValue).mul(Big('80')).toString(),
      startAmount: players[playerIndex].startAmount,
      endAmount,
      tableReType: table.tableType,
    });
  }

  async createReTableHistory(table: ReTable, stuckLeave?: boolean) {
    table.players.map(async (player) => {
      const { main, win, bonus } = await this.walletProvider.getWallet(
        player.userId,
      );
      const endAmount = Big(main).plus(Big(win)).plus(Big(bonus)).toString();
      this.reGameHistoryRepository.createReTableHistory({
        userId: toObjectId(player.userId),
        tableId: table.tableId,
        joinFee: Big(table.tableType.pointValue).mul(Big('80')).toString(),
        startAmount: player.startAmount,
        endAmount,
        tableReType: table.tableType,
      });
    });
  }

  // calculate the points
  async getRoundResult(table: ReTable): Promise<ReGameEndInfo> {
    console.log(`getRoundResult start TableId: ${table.tableId}`);
    let winner = table.players.find(
      (player) => player.playerId === table.firstDeclaredPlayer,
    );

    if (!winner && table.players.length === 1) {
      winner = table.players[0];
    }

    if (!winner) {
      throw new BadRequestException('No winner detected in this round');
    }

    // check if the tableType is correct
    const tableInfos = await this.remoteConfigService.getReTableInfos();
    console.log(`config table Infos ${tableInfos} TableId: ${table.tableId}`);
    const gameCommission =
      (await this.remoteConfigService.getReCommissionsByUsers()[
        table.joinNo.toString()
      ]) || '12';
    console.log(`gameCommission: ${gameCommission} TableId: ${table.tableId}`);

    let totalWinningAmount: number = 0;
    const updatedPlayers = table.players.map((player) => {
      if (
        player.active &&
        player.playerId !== table.firstDeclaredPlayer &&
        player.cardsGroups &&
        table.wildCard
      ) {
        let playerScore: number = 0;
        playerScore = player.isDecValid
          ? calculateScore(player.cardsGroups, table.wildCard, true)
          : calculateScore(player.cardsGroups, table.wildCard, false);
        player.score = playerScore.toString();
        totalWinningAmount += playerScore;
      } else {
        if (winner && player.playerId !== winner.playerId) {
          totalWinningAmount += Number(player.score);
        }
      }
      return player;
    });

    totalWinningAmount += Number(table.droppedScore);

    console.log(
      `Winning Total Score: ${totalWinningAmount} TableId: ${table.tableId}`,
    );

    const winningScore = Big(totalWinningAmount.toString())
      .mul(Big(100).sub(Big(gameCommission)))
      .div(100)
      .toString();

    const winningAmount = Big(winningScore)
      .mul(Big(table.tableType.pointValue))
      .toFixed(2);

    console.log(`Winning Amount: ${winningAmount} TableId: ${table.tableId}`);

    const commissionAmount = Big(totalWinningAmount.toString())
      .mul(Big(gameCommission))
      .div(100)
      .mul(Big(table.tableType.pointValue))
      .toString();

    table.players = updatedPlayers;
    table.commissionAmount = commissionAmount;
    table.updatedAt = dayjs().toISOString();

    const result: ReGameEndInfo = {
      winner: winner.userId,
      winningAmount,
      commissionAmount,
      table,
      tableType: table.tableType,
    };

    return result;
  }

  async sendNotification(tableId: string, readyTime: string) {
    const stuckTableIds = await this.transientDBService.getStuckTable();
    if (stuckTableIds.includes(tableId)) {
      return;
    }

    console.log(`Queue Stuck ${tableId} ${readyTime}`);
    await this.transientDBService.storeStuckTable(tableId);

    this.sendEmailNotification(tableId);

    await this.reGameplayGateway.destroyInactiveTable(tableId);
  }

  async sendQueueNotification(queueName: string) {
    this.sendEmailNotification(queueName);
    await this.reGameplayGateway.clearQueue(queueName);
  }

  // Send Email Notification via AWS SES
  async sendEmailNotification(message: string) {
    const isProduction = config.isDevelopment ? '(Prod)' : '(Dev)';
    AWS.config.update({
      region: config.aws.region as string,
      accessKeyId: config.aws.accessKeyId as string,
      secretAccessKey: config.aws.secretAccessKey as string,
    });

    const ses = new AWS.SES();

    const parameters = {
      Source: 'ashwini@fabzentech.com',
      Destination: {
        ToAddresses: [
          'ashwini@fabzentech.com',
          'product@fabzentech.com',
          'ajay@fabzentech.com',
          'adrian@fabzentech.com',
        ],
      },
      Message: {
        Subject: {
          Data: `SP Table Stuck ${isProduction} ${message}`,
        },
        Body: {
          Text: {
            Data: 'Table stuck ho gya ji. Dekh lijiye Apna Apna',
          },
        },
      },
    };

    // Send the email
    ses.sendEmail(parameters, function (error: any, data: any) {
      if (error) {
        console.log(error, error.stack);
      } else {
        console.log(data);
      }
    });
  }

  async lockUser(userId: UserID) {
    await this.transientDBService.setUserLock(userId, true);
  }

  async unlockUser(userId: UserID) {
    await this.transientDBService.setUserLock(userId, false);
  }

  async checkUserLock(userId: UserID) {
    const locked = await this.transientDBService.getUserLock(userId);

    if (locked) {
      throw new BadRequestException('Still processing your previous request');
    }
    return true;
  }

  getSubWalletSum(amount: SubWallet): string {
    return Big(amount.main)
      .plus(Big(amount.bonus))
      .plus(Big(amount.winning))
      .toString();
  }

  /**
   * get number regarding to the card
   */
  getNumberOfCard(card: Card): number {
    const string_ = card.charAt(0);
    switch (string_) {
      case 'T': {
        return 10;
      }
      case 'J': {
        return 11;
      }
      case 'Q': {
        return 12;
      }
      case 'K': {
        return 13;
      }
      case 'A': {
        return 14;
      }
      default: {
        return Number(string_);
      }
    }
  }

  /**
   * get higher card
   */
  getHigherCard(card1: Card, card2: Card): Card {
    const number1 = this.getNumberOfCard(card1);
    const number2 = this.getNumberOfCard(card2);
    return number1 < number2 ? card2 : card1;
  }

  /**
   * determine which card has the highest rank
   */
  getHighestCard(cards: Card[]): Card {
    if (cards.length !== 3) {
      console.error('Error occured in the number of cards:', cards.length);
      throw new BadRequestException('the number of cards is not 3');
    }
    let temporaryCard: Card;
    temporaryCard = this.getHigherCard(cards[0], cards[1]);
    temporaryCard = this.getHigherCard(temporaryCard, cards[2]);
    return temporaryCard;
  }

  /**
   * sort cards
   */
  sortCards(cards: Card[]): [Card, Card, Card] {
    const a = this.getNumberOfCard(cards[0]);
    const b = this.getNumberOfCard(cards[1]);
    const c = this.getNumberOfCard(cards[2]);
    if (a >= b && b >= c) {
      return [cards[0], cards[1], cards[2]];
    } else if (a >= c && c >= b) {
      return [cards[0], cards[2], cards[1]];
    } else if (b >= a && a >= c) {
      return [cards[1], cards[0], cards[2]];
    } else if (b >= c && c >= a) {
      return [cards[1], cards[2], cards[0]];
    } else if (c >= a && a >= b) {
      return [cards[2], cards[0], cards[1]];
    } else {
      return [cards[2], cards[1], cards[0]];
    }
  }

  /**
   * returns true if the cards is sequence
   */
  getIsSequence(cards: Card[]): boolean {
    const a = this.getNumberOfCard(cards[0]);
    const b = this.getNumberOfCard(cards[1]);
    const c = this.getNumberOfCard(cards[2]);
    const array = [a, b, c];
    array.sort((x, y) => x - y);
    if (array[2] !== 14) {
      return array[1] === array[0] + 1 && array[2] === array[1] + 1;
    } else if (array[1] === 13 && array[0] === 12) {
      return true;
    } else if (array[1] === 3 && array[0] === 2) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * returns true if the cards is color
   */
  getIsColor(cards: Card[]): boolean {
    return cards[0].charAt(1) === cards[1].charAt(1) &&
      cards[0].charAt(1) === cards[2].charAt(1)
      ? true
      : false;
  }

  /**
   * determine which group the cards are in
   */
  getCardsCategory(cards: Card[]): CardsCategory {
    // validation
    if (cards.length !== 3) {
      console.error('Error occured in the number of cards:', cards.length);
      throw new BadRequestException('the number of cards is not 3');
    }
    // check if the group is trail
    if (
      cards[0].charAt(0) === cards[1].charAt(0) &&
      cards[0].charAt(0) === cards[2].charAt(0)
    ) {
      return CardsCategory.trail;
    }
    // check if the group is pure sequence
    if (this.getIsSequence(cards) && this.getIsColor(cards)) {
      return CardsCategory.pureSequence;
    }
    // check if sequence
    if (this.getIsSequence(cards)) {
      return CardsCategory.sequence;
    }
    // check if color
    if (this.getIsColor(cards)) {
      return CardsCategory.color;
    }
    // check if pair
    if (
      cards[0].charAt(0) === cards[1].charAt(0) ||
      cards[0].charAt(0) === cards[2].charAt(0) ||
      cards[1].charAt(0) === cards[2].charAt(0)
    ) {
      return CardsCategory.pair;
    }
    return CardsCategory.highest;
  }

  // get highest 3 cards when the group is high card
  getHighestCards(cards: Card[]): [Card, Card, Card] {
    const numberArray = cards.map((card) => this.getNumberOfCard(card));
    const nums = numberArray.sort((a, b) => b - a).slice(0, 3);
    return nums.map((number_) => {
      return cards.find((card) => this.getNumberOfCard(card) === number_);
    }) as [Card, Card, Card];
  }

  /**
   * select the strongest three cards
   */
  getStrongCards(
    cards: Card[],
    categoryCards: [Card, Card, Card],
    category: CardsCategory,
  ): [Card, Card, Card] {
    if (category === CardsCategory.highest) {
      return this.getHighestCards(cards);
    }
    if (category === CardsCategory.pair) {
      const a = this.getNumberOfCard(categoryCards[0]);
      const b = this.getNumberOfCard(categoryCards[1]);
      const c = this.getNumberOfCard(categoryCards[2]);
      const sortedCards = this.getHighestCards(cards);
      if (a === b) {
        if (this.getNumberOfCard(sortedCards[0]) !== a) {
          return [categoryCards[0], categoryCards[1], sortedCards[0]];
        } else if (this.getNumberOfCard(sortedCards[1]) === a) {
          return [categoryCards[0], categoryCards[1], sortedCards[2]];
        } else {
          return [categoryCards[0], categoryCards[1], sortedCards[1]];
        }
      } else if (a === c) {
        if (this.getNumberOfCard(sortedCards[0]) !== a) {
          return [categoryCards[0], categoryCards[2], sortedCards[0]];
        } else if (this.getNumberOfCard(sortedCards[1]) === a) {
          return [categoryCards[0], categoryCards[2], sortedCards[2]];
        } else {
          return [categoryCards[0], categoryCards[2], sortedCards[1]];
        }
      } else {
        if (this.getNumberOfCard(sortedCards[0]) !== b) {
          return [categoryCards[1], categoryCards[2], sortedCards[0]];
        } else if (this.getNumberOfCard(sortedCards[1]) === b) {
          return [categoryCards[1], categoryCards[2], sortedCards[2]];
        } else {
          return [categoryCards[1], categoryCards[2], sortedCards[1]];
        }
      }
    }
    return this.sortCards(categoryCards);
  }

  /**
   * compare PlayerCardsInfo
   */
  comparePlayerCardsInfo(
    cardsInfo1: PlayerCardsInfo,
    cardsInfo2: PlayerCardsInfo,
  ): CompareResult {
    // either one category is "trail"
    if (
      cardsInfo1.category === CardsCategory.trail ||
      cardsInfo2.category === CardsCategory.trail
    ) {
      if (
        cardsInfo1.category === CardsCategory.trail &&
        cardsInfo2.category === CardsCategory.trail
      ) {
        return this.getNumberOfCard(cardsInfo1.cards[0]) >
          this.getNumberOfCard(cardsInfo2.cards[0])
          ? CompareResult.win
          : CompareResult.lose;
      } else if (cardsInfo1.category === CardsCategory.trail) {
        return CompareResult.win;
      } else {
        return CompareResult.lose;
      }
    }
    // either one category is "pure sequence"
    if (
      cardsInfo1.category === CardsCategory.pureSequence ||
      cardsInfo2.category === CardsCategory.pureSequence
    ) {
      if (
        cardsInfo1.category === CardsCategory.pureSequence &&
        cardsInfo2.category === CardsCategory.pureSequence
      ) {
        if (
          this.getNumberOfCard(cardsInfo1.cards[0]) >
          this.getNumberOfCard(cardsInfo2.cards[0])
        ) {
          return CompareResult.win;
        } else if (
          this.getNumberOfCard(cardsInfo1.cards[0]) <
          this.getNumberOfCard(cardsInfo2.cards[0])
        ) {
          return CompareResult.lose;
        } else {
          if (
            this.getNumberOfCard(cardsInfo1.cards[1]) >
            this.getNumberOfCard(cardsInfo2.cards[1])
          ) {
            return CompareResult.win;
          } else if (
            this.getNumberOfCard(cardsInfo1.cards[1]) <
            this.getNumberOfCard(cardsInfo2.cards[1])
          ) {
            return CompareResult.lose;
          } else {
            return CompareResult.draw;
          }
        }
      } else if (cardsInfo1.category === CardsCategory.pureSequence) {
        return CompareResult.win;
      } else {
        return CompareResult.lose;
      }
    }
    // either one category is "sequence"
    if (
      cardsInfo1.category === CardsCategory.sequence ||
      cardsInfo2.category === CardsCategory.sequence
    ) {
      if (
        cardsInfo1.category === CardsCategory.sequence &&
        cardsInfo2.category === CardsCategory.sequence
      ) {
        if (
          this.getNumberOfCard(cardsInfo1.cards[0]) >
          this.getNumberOfCard(cardsInfo2.cards[0])
        ) {
          return CompareResult.win;
        } else if (
          this.getNumberOfCard(cardsInfo1.cards[0]) <
          this.getNumberOfCard(cardsInfo2.cards[0])
        ) {
          return CompareResult.lose;
        } else {
          if (
            this.getNumberOfCard(cardsInfo1.cards[1]) >
            this.getNumberOfCard(cardsInfo2.cards[1])
          ) {
            return CompareResult.win;
          } else if (
            this.getNumberOfCard(cardsInfo1.cards[1]) <
            this.getNumberOfCard(cardsInfo2.cards[1])
          ) {
            return CompareResult.lose;
          } else {
            return CompareResult.draw;
          }
        }
      } else if (cardsInfo1.category === CardsCategory.sequence) {
        return CompareResult.win;
      } else {
        return CompareResult.lose;
      }
    }
    // either one category is "color"
    if (
      cardsInfo1.category === CardsCategory.color ||
      cardsInfo2.category === CardsCategory.color
    ) {
      if (
        cardsInfo1.category === CardsCategory.color &&
        cardsInfo2.category === CardsCategory.color
      ) {
        if (
          this.getNumberOfCard(cardsInfo1.cards[0]) >
          this.getNumberOfCard(cardsInfo2.cards[0])
        ) {
          return CompareResult.win;
        } else if (
          this.getNumberOfCard(cardsInfo1.cards[0]) <
          this.getNumberOfCard(cardsInfo2.cards[0])
        ) {
          return CompareResult.lose;
        } else {
          if (
            this.getNumberOfCard(cardsInfo1.cards[1]) >
            this.getNumberOfCard(cardsInfo2.cards[1])
          ) {
            return CompareResult.win;
          } else if (
            this.getNumberOfCard(cardsInfo1.cards[1]) <
            this.getNumberOfCard(cardsInfo2.cards[1])
          ) {
            return CompareResult.lose;
          } else {
            if (
              this.getNumberOfCard(cardsInfo1.cards[2]) >
              this.getNumberOfCard(cardsInfo2.cards[2])
            ) {
              return CompareResult.win;
            } else if (
              this.getNumberOfCard(cardsInfo1.cards[2]) <
              this.getNumberOfCard(cardsInfo2.cards[2])
            ) {
              return CompareResult.lose;
            } else {
              return CompareResult.draw;
            }
          }
        }
      } else if (cardsInfo1.category === CardsCategory.color) {
        return CompareResult.win;
      } else {
        return CompareResult.lose;
      }
    }
    // either one category is "pair"
    if (
      cardsInfo1.category === CardsCategory.pair ||
      cardsInfo2.category === CardsCategory.pair
    ) {
      if (
        cardsInfo1.category === CardsCategory.pair &&
        cardsInfo2.category === CardsCategory.pair
      ) {
        if (
          this.getNumberOfCard(cardsInfo1.cards[0]) >
          this.getNumberOfCard(cardsInfo2.cards[0])
        ) {
          return CompareResult.win;
        } else if (
          this.getNumberOfCard(cardsInfo1.cards[0]) <
          this.getNumberOfCard(cardsInfo2.cards[0])
        ) {
          return CompareResult.lose;
        } else {
          if (
            this.getNumberOfCard(cardsInfo1.cards[2]) >
            this.getNumberOfCard(cardsInfo2.cards[2])
          ) {
            return CompareResult.win;
          } else if (
            this.getNumberOfCard(cardsInfo1.cards[2]) <
            this.getNumberOfCard(cardsInfo2.cards[2])
          ) {
            return CompareResult.lose;
          } else {
            return CompareResult.draw;
          }
        }
      } else if (cardsInfo1.category === CardsCategory.pair) {
        return CompareResult.win;
      } else {
        return CompareResult.lose;
      }
    }
    // compare the highest number
    if (
      this.getNumberOfCard(cardsInfo1.cards[0]) >
      this.getNumberOfCard(cardsInfo2.cards[0])
    ) {
      return CompareResult.win;
    } else if (
      this.getNumberOfCard(cardsInfo1.cards[0]) <
      this.getNumberOfCard(cardsInfo2.cards[0])
    ) {
      return CompareResult.lose;
    } else {
      if (
        this.getNumberOfCard(cardsInfo1.cards[1]) >
        this.getNumberOfCard(cardsInfo2.cards[1])
      ) {
        return CompareResult.win;
      } else if (
        this.getNumberOfCard(cardsInfo1.cards[1]) <
        this.getNumberOfCard(cardsInfo2.cards[1])
      ) {
        return CompareResult.lose;
      } else {
        if (
          this.getNumberOfCard(cardsInfo1.cards[2]) >
          this.getNumberOfCard(cardsInfo2.cards[2])
        ) {
          return CompareResult.win;
        } else if (
          this.getNumberOfCard(cardsInfo1.cards[2]) <
          this.getNumberOfCard(cardsInfo2.cards[2])
        ) {
          return CompareResult.lose;
        } else {
          return CompareResult.draw;
        }
      }
    }
  }

  /**
   * Get hands result
   */
  getPlayerCardsInfo(cards: Card[]): PlayerCardsInfo {
    if (cards.length !== 4) {
      console.error('Error occured in the number of cards:', cards.length);
      throw new BadRequestException('the number of cards is not 4');
    }
    const list = [0, 1, 2, 3];
    const groups: any = []; // groups is the array which length is 4
    let playerCardsInfo: PlayerCardsInfo = {
      category: CardsCategory.highest,
      cards: this.getHighestCards(cards),
    };

    // get all available groups of 3
    for (let index = 0; index < list.length - 2; index++) {
      for (let index_ = index + 1; index_ < list.length - 1; index_++) {
        for (let k = index_ + 1; k < list.length; k++) {
          groups.push([
            cards[list[index]],
            cards[list[index_]],
            cards[list[k]],
          ]);
        }
      }
    }

    // get the strong player cards info
    for (const group of groups) {
      const cardsCategory = this.getCardsCategory(group);
      const strongCards = this.getStrongCards(cards, group, cardsCategory);
      const temporaryPlayerCardsInfo: PlayerCardsInfo = {
        category: cardsCategory,
        cards: strongCards,
      };

      if (
        this.comparePlayerCardsInfo(
          playerCardsInfo,
          temporaryPlayerCardsInfo,
        ) === CompareResult.lose
      ) {
        playerCardsInfo = temporaryPlayerCardsInfo;
      }
    }

    return playerCardsInfo;
  }

  /**
   * side show
   */
  sideShow(
    table: Table,
    playerId1: PlayerId,
    playerId2: PlayerId,
  ): SideShowInfo {
    const playersInfo: SideShowCardsInfo[] = [];
    let sideShowInfo: SideShowInfo;

    if (table.hidden) {
      table.players.map((player) => {
        if (player.playerId === playerId1 || player.playerId === playerId2) {
          const hiddenCards = player.hiddenCards as [Card, Card];
          const playerCards = [
            player.firstCard as Card,
            hiddenCards[0] as Card,
            hiddenCards[1] as Card,
          ] as [Card, Card, Card];
          const category = this.getCardsCategory(playerCards);
          const strongCards = this.getStrongCards(
            playerCards,
            playerCards,
            category,
          );
          const playerCardsInfo: PlayerCardsInfo = {
            category: category,
            cards: strongCards,
          };
          const info = {
            id: player.playerId,
            playerCardsInfo: playerCardsInfo,
          };
          playersInfo.push(info);
        }
      });
    } else {
      table.players.map((player) => {
        if (player.playerId === playerId1 || player.playerId === playerId2) {
          const hiddenCards = player.hiddenCards as [Card, Card];
          const playerCardsInfo: PlayerCardsInfo = this.getPlayerCardsInfo([
            player.firstCard as Card,
            hiddenCards[0] as Card,
            hiddenCards[1] as Card,
            table.commonCard as Card,
          ]);
          const info = {
            id: player.playerId,
            playerCardsInfo: playerCardsInfo,
          };
          playersInfo.push(info);
        }
      });
    }

    const result = this.comparePlayerCardsInfo(
      playersInfo[0].playerCardsInfo as PlayerCardsInfo,
      playersInfo[1].playerCardsInfo as PlayerCardsInfo,
    );
    if (result === CompareResult.win) {
      sideShowInfo = {
        winner: playersInfo[0].id,
        info: playersInfo,
      };
    } else if (result === CompareResult.lose) {
      sideShowInfo = {
        winner: playersInfo[1].id,
        info: playersInfo,
      };
    } else {
      sideShowInfo = {
        winner: '',
        info: playersInfo,
      };
    }
    return sideShowInfo;
  }

  /**
   * Get winners and their cards info of the table
   */
  getWinners(info: WinnerCompareInfo): PlayerId[] {
    let winners: PlayerId[] = [];
    let winnerCardsInfo: PlayerCardsInfo = {
      category: CardsCategory.highest,
      cards: [Card.cd1, Card.cd27, Card.cd40],
    };

    for (let index = 0; index < info.playersInfo.length; index++) {
      const playerCardsInfo = this.getPlayerCardsInfo([
        ...(info.playersInfo[index].cards as [Card, Card, Card]),
        info.commonCard as Card,
      ]);
      if (index === 0) {
        winners.push(info.playersInfo[0].playerId);
        winnerCardsInfo = playerCardsInfo;
      } else {
        const result: CompareResult = this.comparePlayerCardsInfo(
          winnerCardsInfo,
          playerCardsInfo,
        );
        if (result === CompareResult.lose) {
          winnerCardsInfo = playerCardsInfo;
          winners = [];
          winners.push(info.playersInfo[index].playerId);
        } else if (result === CompareResult.draw) {
          winners.push(info.playersInfo[index].playerId);
        } else {
        }
      }
    }
    return winners;
  }
  /**
   * when the game ends
   */
  gameEnd(table: Table): GameEndInfo {
    const gameCommission =
      this.remoteConfigService.getSpCommissionsByUsers()[
        `${table.roundStartPlayersNo}`
      ] ?? '10';
    let potAmount = Big(table.potAmount)
      .mul(Big(100).sub(gameCommission))
      .div(100)
      .toString();
    const commissionAmount = Big(table.potAmount)
      .mul(gameCommission)
      .div(100)
      .toString();
    const winnerIds: PlayerId[] = [];
    const winnerUserIds: string[] = [];
    const winnerAmounts: WinnerAmount[] = [];
    const players: PlayerEndInfo[] = [];

    if (table.commonCard) {
      let loop = 0;
      while (Big(potAmount).gt('0.02') && loop < 12) {
        const playerCards: any = [];
        loop++;
        table.players.map((player) => {
          if (
            !winnerIds.includes(player.playerId) &&
            (player.active || player.allin)
          ) {
            playerCards.push({
              playerId: player.playerId,
              cards: [
                player.firstCard as Card,
                ...(player.hiddenCards as [Card, Card]),
              ],
            } as PlayerCards);
          }
        });
        const winnerCompareInfo: WinnerCompareInfo = {
          commonCard: table.commonCard,
          playersInfo: playerCards as PlayerCards[],
        };
        let winners: PlayerId[] = this.getWinners(winnerCompareInfo);
        winners.map((winner) => {
          winnerIds.push(winner);
          const index = table.players.findIndex(
            (player) => player.playerId === winner,
          );
          winnerUserIds.push(table.players[index].userId);
        });
        let flag = true;
        while (flag && winners.length > 0) {
          loop++;
          flag = false;
          const remainingWinners: PlayerId[] = [];
          const baseAmount: string = Big(potAmount)
            .div(winners.length)
            .toString();
          winners.map((winner) => {
            const index = table.players.findIndex(
              (player) => player.playerId === winner,
            );
            if (table.players[index].allin) {
              const sidepot = Big(table.players[index].sidepot)
                .mul(Big(100).sub(gameCommission))
                .div(100)
                .toString();
              if (Big(sidepot).lt(Big(baseAmount))) {
                winnerAmounts.push({ playerId: winner, amount: sidepot });
                potAmount = Big(potAmount).minus(Big(sidepot)).toString();
                flag = true;
              } else {
                remainingWinners.push(winner);
              }
            } else {
              remainingWinners.push(winner);
            }
          });
          winners = remainingWinners;
        }
        if (winners.length > 0) {
          const amount = Big(potAmount).div(winners.length).toString();
          winners.map((winner) => {
            winnerAmounts.push({ playerId: winner, amount: amount });
            potAmount = Big(potAmount).minus(Big(amount)).toString();
          });
        }
      }
    } else {
      table.players.map((player) => {
        if (player.active || player.allin) {
          winnerAmounts.push({ playerId: player.playerId, amount: potAmount });
          winnerIds.push(player.playerId);
          winnerUserIds.push(player.userId);
          potAmount = '0';
        }
      });
    }

    // Update the winning amount of the active or allin players
    table.players.map((player) => {
      if (player.allin || player.active) {
        let playerAmount = this.getSubWalletSum(player.amount);
        let amount = '0';
        if (winnerIds.includes(player.playerId)) {
          const index = winnerAmounts.findIndex(
            (winnerAmount) => winnerAmount.playerId === player.playerId,
          );
          playerAmount = Big(playerAmount)
            .plus(winnerAmounts[index].amount)
            .toString();
          amount = winnerAmounts[index].amount;
        }
        if (table.commonCard) {
          const handCards: [Card, Card, Card] = [
            player?.firstCard as Card,
            ...(player.hiddenCards as [Card, Card]),
          ];
          const playerCardsInfo = this.getPlayerCardsInfo([
            ...(handCards as [Card, Card, Card]),
            table.commonCard as Card,
          ]);
          const playerEndInfo: PlayerEndInfo = {
            playerId: player.playerId,
            playerCardsInfo,
            handCards,
            playerAmount,
            amount,
          };
          players.push(playerEndInfo);
        } else {
          const playerEndInfo: PlayerEndInfo = {
            playerId: player.playerId,
            playerAmount,
            amount,
          };
          players.push(playerEndInfo);
        }
      }
    });

    const gameEndInfo: GameEndInfo = {
      winners: winnerIds,
      winnerUserIds,
      playersEndInfo: players,
      commissionAmount,
    };

    return gameEndInfo;
  }
}
