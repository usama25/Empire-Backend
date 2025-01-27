import { customAlphabet } from 'nanoid';
import { Injectable, BadRequestException } from '@nestjs/common';
import * as dayjs from 'dayjs';

import {
  GameStatus,
  PlayerId,
  PlayerGameInfo,
  GameTableData,
  JoinTableRequest,
  StartGameParameters,
  Games,
} from '@lib/fabzen-common/types';

import { TableService, CommonService } from './services/gameplay';

import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { WaitingTableQueueService } from './services/queue';
import { SpGameplayGateway } from './sp-gameplay.gateway';
import { getPlayerId } from './utils/sp-gameplay.utils';
import Big from 'big.js';
import { config } from '@lib/fabzen-common/configuration';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

@Injectable()
export class SpGameplayService {
  constructor(
    private readonly tableService: TableService,
    private readonly commonService: CommonService,
    private readonly waitingTableQueueService: WaitingTableQueueService,
    private readonly spGameplayGateway: SpGameplayGateway,
    private readonly transientDBService: RedisTransientDBService,
    private readonly userRepository: UserRepository,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  async joinTable({ userId, tableType }: JoinTableRequest) {
    const doubleJoined = await this.tableService.checkDoubleJoin(
      tableType,
      userId,
    );
    if (doubleJoined) {
      throw new BadRequestException(
        `Only one table can be joined at a time, ${doubleJoined}`,
      );
    }

    const { walletBalance } = await this.commonService.checkWalletBalance(
      userId,
      tableType.minJoinAmount,
    );

    if (Big(walletBalance.main).lt(Big('0'))) {
      throw new BadRequestException(`Wallet balance is not enough`);
    }
    return Big(this.commonService.getSubWalletBalance(walletBalance))
      .plus(tableType.minJoinAmount)
      .toString();
  }

  // start game with new users from waiting table
  async createNewTable({ tableType, users }: StartGameParameters) {
    const tableId = customAlphabet(config.spGameplay.alphaNumberics, 12)();
    const userIds = users.map((user) => user.userId);
    const amounts = users.map((user) => user.amount);
    const players = users.map((user, index) => ({
      userId: user.userId,
      playerId: getPlayerId(index + 1),
      walletBalance: user.walletBalance,
      amount: user.amount,
      startAmount: this.commonService.getSubWalletSum(user.amount),
      roundAmount: this.commonService.getSubWalletSum(user.amount),
      active: false,
      allin: false,
      sidepot: '0',
      seen: false,
      chaalAfterSeen: false,
      lastBetAmount: '0',
      betAmount: '0',
      rebuying: false,
      joinedRoundNo: 1,
    })) as PlayerGameInfo[];
    for (const player of players) {
      player.playerInfo = await this.userRepository.getUserGameDetails(
        player.userId,
        Games.skillpatti,
      );
    }

    const newTable = {
      tableType,
      tableId,
      roundNo: 0,
      players,
      dealerId: PlayerId.pl1,
      currentTurn: PlayerId.pl1,
      joinNo: players.length,
      turnNo: 0,
      gameStatus: GameStatus.waiting,
      hidden: true,
      chaalAmount: tableType.initialBetAmount,
      potAmount: '0',
      skipTurnNo: 0,
      roundStartPlayersNo: players.length,
      updated: dayjs().toISOString(),
      isMaintenanceBypass: users[0].isMaintenanceBypass,
    };
    try {
      // const playerDetails = await this.commonService.getPlayersDetail(players);
      await this.tableService.storeTable(newTable);
      await players.map(async ({ userId }) => {
        await this.transientDBService.setUserActiveTableId(userId, tableId);
        if (
          Number(tableType.minJoinAmount) >=
          Number(
            this.remoteConfigService.getSpMatchMakingNotificationConfig()
              .minimumJoinAmountForNotifications,
          )
        ) {
          await this.transientDBService.deleteBigTableUser(userId);
        }
      });
      await this.spGameplayGateway.joinTable(userIds, tableId);

      // for online user count
      // this.spGameplayGateway.handleJoinUser(tableType, users.length);

      // debit join amounts
      this.commonService.debitTable(userIds, amounts, tableId);

      this.spGameplayGateway.startRound(newTable.tableId);
    } catch (error) {
      console.error(`Error Occured during game initialization: ${error}`);
      // remove user table key
      players.map(({ userId }) =>
        this.transientDBService.deleteUserActiveTableId(userId),
      );

      // Remove table key
      this.transientDBService.deleteActiveTable(tableId);
    }
  }

  async leaveWaitingTable(userId: string, isEmit?: boolean) {
    const userWaitingInfo =
      await this.transientDBService.getUserWaitingTable(userId);
    const checkIfJoined = await this.commonService.checkIfJoined(userId);

    let failed = false;

    if (userWaitingInfo && !checkIfJoined) {
      const { tableType } = userWaitingInfo;

      // wait until queue unlocked
      while (
        await this.transientDBService.getQueueLock(tableType.tableTypeId)
      ) {
        console.log('queue lock for leaveWaitingTable', tableType.tableTypeId);
        delay(200);
      }
      if (
        await this.waitingTableQueueService.isUserOnQueue(tableType, userId)
      ) {
        await this.waitingTableQueueService.removeFromQueue(tableType, userId);
      } else {
        failed = true;
      }
    } else {
      failed = true;
    }
    if (!isEmit) {
      this.spGameplayGateway.leftWaitingTable(userId, !failed);
    }
  }

  async getGameTable(
    tableId?: string,
    userId?: string,
    amount?: string,
  ): Promise<GameTableData[]> {
    if (tableId) {
      return this.getGameTablePlayersFromTable(tableId);
    } else if (userId) {
      const tableId =
        await this.transientDBService.getUserActiveTableId(userId);
      if (!tableId) {
        return [];
      }
      return this.getGameTablePlayersFromTable(tableId);
    } else {
      const tableIds = await this.transientDBService.getActiveTableIds();
      const tableData: GameTableData[] = [];
      await Promise.all(
        tableIds.map(async (tableId) => {
          const data = await this.getGameTablePlayersFromTable(tableId);
          if (amount && data[0].tableType.minJoinAmount === amount) {
            tableData.push(data[0]);
          }
          if (!amount) {
            tableData.push(data[0]);
          }
        }),
      );
      return tableData;
    }
  }

  async getGameTablePlayersFromTable(
    tableId: string,
  ): Promise<GameTableData[]> {
    const tableIds = await this.transientDBService.getActiveTableIds();
    const _tableId = tableIds.find(
      (id) => id.toLowerCase() === tableId.toLowerCase(),
    );
    if (!_tableId) {
      return [];
    }
    const table = await this.transientDBService.getActiveTable(_tableId);
    if (!table) {
      return [];
    }
    const playersData = table.players.map(
      ({
        playerId,
        userId,
        walletBalance,
        active,
        startAmount,
        roundAmount,
        amount,
        playerInfo,
        joinedRoundNo,
      }: PlayerGameInfo) => ({
        playerId,
        userId,
        walletBalance,
        active,
        startAmount,
        roundAmount,
        amount,
        username: playerInfo.username,
        joinedRoundNo,
      }),
    );
    return [
      {
        tableId: table.tableId,
        tableType: table.tableType,
        roundNo: table.roundNo,
        players: playersData,
        updatedAt: table.updated,
      },
    ];
  }
}
