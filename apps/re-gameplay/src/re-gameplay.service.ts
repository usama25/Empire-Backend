import { customAlphabet } from 'nanoid';
import { Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';

import { Games } from '@lib/fabzen-common/types';

import { TableService, CommonService } from './services/gameplay';

import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { ReQueueService, WaitingTableQueueService } from './services/queue';
import { ReGameplayGateway } from './re-gameplay.gateway';
import {
  getEarliestTimer,
  getRePlayerId,
  leaveLogs,
} from './utils/re-gameplay.utils';
import Big from 'big.js';
import { config } from '@lib/fabzen-common/configuration';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import {
  GameTableData,
  PlayerInfo,
  ReGameOption,
  ReGameStatus,
  RePlayerId,
  ReStartGameParameters,
  ReTableWithPid,
} from './re-gameplay.types';
import { RedisService } from './services/transient-db/redis/service';

@Injectable()
export class ReGameplayService {
  constructor(
    private readonly tableService: TableService,
    private readonly commonService: CommonService,
    private readonly waitingTableQueueService: WaitingTableQueueService,
    private readonly reGameplayGateway: ReGameplayGateway,
    private readonly reQueueService: ReQueueService,
    private readonly transientDBService: RedisTransientDBService,
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
  ) {}

  async createNewReTable({ tableType, users }: ReStartGameParameters) {
    const tableId = customAlphabet(config.reGameplay.alphaNumberics, 12)();
    const roundId = customAlphabet(config.reGameplay.alphaNumberics, 12)();
    const userIds = users.map((user) => user.userId);
    const timeouts: string[] = users.map((user) => {
      return dayjs.unix(user.expiry).toISOString();
    });
    const players = users.map((user, index) => {
      const startAmount: string = Big(
        this.commonService.getSubWalletSum(user.amount),
      )
        .plus(this.commonService.getSubWalletSum(user.walletBalance))
        .toString();

      return {
        userId: user.userId,
        playerId: getRePlayerId(index + 1),
        active: true,
        isDrawn: false,
        isDiscarded: false,
        declare: false,
        isFirstDeclared: false,
        isDecValid: true,
        late: false,
        turnNo: 0,
        drop: false,
        softDrop: false,
        score: '0',
        startAmount,
      };
    }) as PlayerInfo[];

    for (const player of players) {
      player.playerInfo = await this.userRepository.getUserGameDetails(
        player.userId,
        Games.rummyempire,
      );
    }

    const earliestTimeout = getEarliestTimer(timeouts);
    console.log("The Earliest Player's Timeout", earliestTimeout);
    const currentTime = dayjs().toISOString();
    const delay = dayjs(earliestTimeout).diff(dayjs(currentTime), 'second');
    console.log('Remaining Matching Time for Other players', delay);

    const newTable = {
      tableId,
      dealerId: RePlayerId.pl1,
      currentTurn: RePlayerId.pl1,
      joinNo: players.length,
      roundId,
      variation: tableType.variation,
      maxPlayer: tableType.maxPlayer,
      gameOption: ReGameOption.practice,
      gameStatus: ReGameStatus.waiting,
      serverTime: currentTime,
      turnNo: 0,
      timeout: earliestTimeout,
      tableType,
      players,
      leftPlayers: [],
      locked: false,
      declaredNo: 0,
      droppedScore: '0',
      commissionAmount: '0',
      closedDeckCards: [],
      openDeckCards: [],
      createdAt: currentTime,
      updatedAt: currentTime,
      isMaintenanceBypass: users[0].isMaintenanceBypass,
    };
    try {
      // Store the table and set active table for players
      await Promise.all([
        this.tableService.storeReTable(newTable),
        ...players.map(({ userId }) =>
          this.transientDBService.setUserActiveTableId(userId, tableId),
        ),
        this.reGameplayGateway.joinTable(userIds, tableId),
      ]);

      // Get table details and handle locking
      const { pid } = (await this.tableService.getReTableOrThrowException(
        tableId,
      )) as ReTableWithPid;
      leaveLogs('RE empty table lock', { tableId, pid });

      // Release lock and add timeout action
      await Promise.all([
        this.redisService.releaseLock(tableId, pid),
        this.reGameplayGateway.startReRound(tableId),
      ]);
    } catch (error) {
      console.error(`Error occurred during game initialization: ${error}`);

      // Rollback changes on error
      await Promise.all([
        ...players.map(({ userId }) =>
          this.transientDBService.deleteUserActiveTableId(userId),
        ),
        this.transientDBService.deleteActiveTable(tableId),
      ]);
    }
  }

  async leaveWaitingTable(userId: string, isEmit?: boolean) {
    const userWaitingInfo =
      await this.transientDBService.getReUserWaitingTable(userId);
    const checkIfJoined = await this.commonService.checkIfJoined(userId);

    let failed = false;

    if (userWaitingInfo && !checkIfJoined) {
      const { tableType } = userWaitingInfo;

      // wait until queue unlocked
      while (
        await this.transientDBService.getQueueLock(tableType.tableTypeId)
      ) {
        // console.log('queue lock for leaveWaitingTable', tableType.tableTypeId);
        delay(10);
      }
      if (
        await this.waitingTableQueueService.isUserOnReQueue(tableType, userId)
      ) {
        await this.waitingTableQueueService.removeFromReQueue(
          tableType,
          userId,
        );
      } else {
        failed = true;
      }
    } else {
      failed = true;
    }
    if (!isEmit) {
      this.reGameplayGateway.leftWaitingTable(userId, !failed);
    }
  }

  async handleMatchingTime(userId: string, matchingNo: string) {
    console.log('handleMatchingTime invoked!');
    const currentMatchingNo = matchingNo
      ? await this.transientDBService.getUserMatchingCount(userId)
      : undefined;

    if (currentMatchingNo && matchingNo === currentMatchingNo) {
      console.log('MatchingNo Condition');

      const userWaitingInfo =
        await this.transientDBService.getReUserWaitingTable(userId);
      const checkIfJoined = await this.commonService.checkIfJoined(userId);

      console.log('userWaitingInfo boolean', !!userWaitingInfo);
      console.log('userWaitingInfo value', userWaitingInfo);
      console.log('checkIfJoined value', !checkIfJoined);

      if (!!userWaitingInfo && !checkIfJoined) {
        console.log('CheckIfJoined Condition');

        await this.transientDBService.setUserMatchingCount(userId, 0);

        const { tableType } = userWaitingInfo;

        // wait until queue unlocked
        while (
          await this.transientDBService.getQueueLock(tableType.tableTypeId)
        ) {
          // console.log('queue lock for leaveWaitingTable', tableType.tableTypeId);
          delay(10);
        }
        if (
          await this.waitingTableQueueService.isUserOnReQueue(tableType, userId)
        ) {
          console.log('IsUserOnReQueue Condition');
          await this.waitingTableQueueService.removeFromReQueue(
            tableType,
            userId,
          );
          await this.reGameplayGateway.handleExpiredUsers(userId);
        }
      }
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
          if (
            amount &&
            Big(data[0].tableType.pointValue).mul(Big('80')).toString() ===
              amount
          ) {
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

  async checkIfReconnected(userId: string): Promise<boolean> {
    const activeTableId =
      await this.transientDBService.getUserActiveTableId(userId);
    const userWaitingInfo =
      await this.transientDBService.getReUserWaitingTable(userId);
    return !!activeTableId || !!userWaitingInfo;
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
    const table = await this.transientDBService.getActiveReTable(_tableId);
    if (!table) {
      return [];
    }

    const playersData = table.players.map(
      ({ playerId, userId, playerInfo }) => ({
        playerId,
        userId,
        username: playerInfo.username,
      }),
    );
    return [
      {
        tableId: table.tableId,
        tableType: table.tableType,
        roundId: table.roundId,
        gameStatus: table.gameStatus,
        players: playersData,
        updatedAt: table.updatedAt,
      },
    ];
  }

  async clearTable(tableId: string) {
    const { table, pid } =
      await this.tableService.getReTableOrThrowException(tableId);
    try {
      const userIds = table.players.map((player) => player.userId);
      await this.reGameplayGateway.destroyInactiveTable(tableId);
      for (const userId of userIds) {
        await this.transientDBService.deleteReUserActiveTableId(userId);
      }
      await this.transientDBService.deleteActiveReTable(tableId);
    } catch (error) {
      console.error(`Error Occured during clearing table: ${error}`);
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId, pid);
    }
  }
}
