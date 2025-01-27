import { customAlphabet } from 'nanoid';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';
import {
  GameStatus,
  PlayerId,
  PlayerInfo,
  Table,
  GameAction,
  TableType,
  CreateTableParameter,
  JoinTableParameter,
  GameTableData,
} from './cbr-gameplay.types';

import { TableService, CommonService } from './services/gameplay';
import { RedisTransientDBService } from './redis/backend';
import { RedisService } from './redis/service';
import { CbrGameplayGateway } from './cbr-gameplay.gateway';
import { config } from '@lib/fabzen-common/configuration';
import { CbrQueueService } from './services/queue/cbr-queue.service';
import { CBLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

@Injectable()
export class CbrGameplayService {
  private readonly logger = new FbzLogger(CbrGameplayService.name);

  constructor(
    private readonly tableService: TableService,
    private readonly commonService: CommonService,
    @Inject(forwardRef(() => CbrGameplayGateway))
    private readonly cbrGameplayGateway: CbrGameplayGateway,
    private readonly transientDBService: RedisTransientDBService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => CbrQueueService))
    private readonly cbrQueueService: CbrQueueService,
    private readonly configService: RemoteConfigService,
  ) {}

  // Create New Waiting Table
  async createNewTable({
    tableType,
    userId,
  }: CreateTableParameter): Promise<Table | undefined> {
    const tableId = customAlphabet(config.cbrGameplay.alphaNumberics, 12)();
    const totalRounds = tableType.totalRounds;
    const scores = Array.from({ length: totalRounds }, () => '0');
    // Get Player Detail
    const playerInfo = await this.commonService.attachPlayerDetail(userId);
    const newPlayer: PlayerInfo = {
      userId,
      playerInfo,
      playerId: PlayerId.pl1,
      active: true,
      handBid: 0,
      roundScore: '0',
      currentHand: 0,
      scores,
      totalScore: '0',
    };
    const players: PlayerInfo[] = [];
    players.push(newPlayer);
    const timeout = dayjs()
      .add(config.cbrGameplay.timeout.matchingTimeout, 'second')
      .toISOString();
    const newTable: Table = {
      tableId,
      tableType,
      roundNo: 0,
      handNo: 0,
      totalRounds,
      turnNo: 0,
      dealerId: PlayerId.pl1,
      currentTurn: PlayerId.pl1,
      gameStatus: GameStatus.waiting,
      updatedAt: dayjs().toISOString(),
      players,
      timeout,
    };
    try {
      await this.transientDBService.setUserActiveTableId(userId, tableId);
      await this.transientDBService.setPublicWaitingTable(tableType, newTable);
      await this.tableService.storeTable(newTable);
      const payload = {
        tableTypeId: tableType.tableTypeId,
      };
      this.cbrQueueService.addTimeoutAction(
        tableId,
        GameAction.deleteTable,
        config.cbrGameplay.timeout.matchingTimeout,
        payload,
      );
      return newTable;
    } catch (error) {
      this.logger.error(`Error Occured during game initialization: ${error}`);
      // remove user table key
      this.transientDBService.deleteUserActiveTableId(userId);
      // Remove table key
      this.transientDBService.deleteActiveTable(tableId);
    }
  }

  // Join the exsiting waiting table
  async joinExistingTable({
    waitingTable,
    userId,
  }: JoinTableParameter): Promise<Table | undefined> {
    try {
      await this.redisService.aquireLock(waitingTable.tableId);
      const playerInfo = await this.commonService.attachPlayerDetail(userId);
      const playerId = (await this.commonService.getNextEmptyPlayerId(
        waitingTable,
      )) as PlayerId;
      const scores = Array.from(
        { length: waitingTable.totalRounds },
        () => '0',
      );
      const newPlayer: PlayerInfo = {
        userId,
        playerInfo,
        playerId,
        active: true,
        handBid: 0,
        currentHand: 0,
        scores,
        roundScore: '0',
        totalScore: '0',
      };

      waitingTable.players.push(newPlayer);
      waitingTable.updatedAt = dayjs().toISOString();
      await this.transientDBService.setUserActiveTableId(
        userId,
        waitingTable.tableId,
      );
      await this.transientDBService.setPublicWaitingTable(
        waitingTable.tableType,
        waitingTable,
      );
      await this.tableService.storeTable(waitingTable);
      return waitingTable;
    } catch (error) {
      throw error;
    } finally {
      await this.redisService.releaseLock(waitingTable.tableId);
    }
  }

  /**
   * Join in public table
   */
  async joinTable(tableType: TableType, userId: string) {
    try {
      const waitingTable =
        await this.transientDBService.getPublicWaitingTable(tableType);
      const table = waitingTable
        ? await this.joinExistingTable({
            waitingTable,
            userId,
          })
        : await this.createNewTable({
            tableType,
            userId,
          });

      const matchMakingNotifications =
        await this.configService.getCbrMatchMakingNotificationConfig();
      if (
        Number(tableType.amount) >=
        Number(matchMakingNotifications.minimumJoinAmountForNotifications)
      ) {
        const userIds = await this.transientDBService.getBigTableUsers();
        console.log('ExpiredUsers', userIds);
        //  exclude my userId
        const otherUserIds = userIds.filter((id) => id !== userId);

        if (
          matchMakingNotifications.isPushNotificationsEnabled &&
          otherUserIds.length > 0
        ) {
          await this.cbrGameplayGateway.sendMatchMakingPushNotification(
            otherUserIds,
            tableType.amount,
          );
        }
        if (
          matchMakingNotifications.isSocketNotificationsEnabled &&
          otherUserIds.length > 0
        ) {
          await this.cbrGameplayGateway.sendMatchMakingSocketNotification(
            otherUserIds,
            tableType.amount,
          );
        }
      }

      await this.cbrGameplayGateway.joinTable(table as Table, userId);
    } catch (error) {
      this.logger.error(`Error Occured during joining table: ${error}`);
    }
  }

  async leaveTableInWaiting(
    tableTypeId: string,
    tableId: string,
    userId: string,
  ): Promise<PlayerId | undefined> {
    try {
      const table = await this.tableService.getTableOrThrowException(tableId);
      let playerId;
      if (table.players.length === 1) {
        table.players.map((player) => {
          if (player.userId === userId) {
            playerId = player.playerId;
          }
        });
        await this.transientDBService.deleteUserActiveTableId(userId);
        await this.tableService.removeTable(table);
        await this.tableService.removeWaitingTable(table);
        return playerId;
      } else {
        if (table.gameStatus === GameStatus.waiting) {
          const players: PlayerInfo[] = [];
          table.players.map((player) => {
            if (player.userId === userId) {
              playerId = player.playerId;
            } else {
              players.push(player);
            }
          });
          table.players = players;
          table.updatedAt = dayjs().toISOString();
          await this.tableService.storeTable(table);
          await this.transientDBService.setPublicWaitingTable(
            table.tableType,
            table,
          );
          await this.transientDBService.deleteUserActiveTableId(userId);
          return playerId;
        } else {
          return playerId;
        }
      }
    } catch (error) {
      this.logger.error(`Error Occured during leave table: ${error}`);
      throw error;
    } finally {
    }
  }

  async endGame(tableId: string) {
    const table = await this.tableService.getTableOrThrowException(tableId);
    try {
      // Add Winning Amount
      await this.commonService.addWinningAmount(table);
      await this.tableService.removeTable(table);
    } catch (error) {
      this.logger.error(`Error Occured during ending game: ${error}`);
    }
  }

  async getGameTables(cbrLiveGamesRequest: CBLiveGamesRequest) {
    const { tableId, userId, amount, skip, count } = cbrLiveGamesRequest;
    try {
      const gameTable = await this.getGameTable(tableId, userId, amount);
      // get gameTable data for players from skip to skip + count
      let skipCount = skip;
      let playerCount = count;
      const response: GameTableData[] = [];
      const waitingResponse: GameTableData[] = [];
      for (const table of gameTable) {
        if (playerCount <= 0) {
          continue;
        }
        if (skipCount >= table.players.length) {
          skipCount -= table.players.length;
          continue;
        }
        const players = table.players.slice(skipCount, skipCount + playerCount);
        response.push({
          tableId: table.tableId,
          tableType: table.tableType,
          roundNo: table.roundNo,
          totalRounds: table.totalRounds,
          players,
          gameStatus: table.gameStatus,
          updatedAt: table.updatedAt,
        });
        playerCount -= players.length;
        skipCount = 0;
      }

      const totalGameData = await this.getGameTable();
      const waitingGameData = await this.getWaitingGameTable();

      for (const table of waitingGameData) {
        waitingResponse.push({
          tableId: table.tableId,
          tableType: table.tableType,
          roundNo: table.roundNo,
          totalRounds: table.totalRounds,
          players: table.players,
          gameStatus: table.gameStatus,
          updatedAt: table.updatedAt,
        });
      }

      let waitingUserCount = 0;
      if (waitingGameData.length > 0) {
        waitingGameData.map((table) => {
          waitingUserCount += table.players.length;
        });
      }
      const stuckTables = response.filter(
        (table) => table.updatedAt && dayjs().diff(table.updatedAt) >= 60_000,
      );
      const stuckTableCount = stuckTables.length;
      return {
        gameTables: response,
        tableCount: totalGameData.length,
        stuckTables,
        stuckTableCount,
        playerCount: totalGameData.reduce(
          (accumulator, table) => accumulator + table.players.length,
          0,
        ),
        waitingTables: waitingResponse,
        waitingTableCount: waitingGameData.length,
        waitingUserCount,
      };
    } catch (error) {
      this.logger.error('Error occurred at the getGameTables', {
        error,
      });
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
            data[0].tableType.amount === amount &&
            data[0].gameStatus !== GameStatus.waiting
          ) {
            tableData.push(data[0]);
          }
          if (!amount && data[0].gameStatus !== GameStatus.waiting) {
            tableData.push(data[0]);
          }
        }),
      );
      return tableData;
    }
  }

  async getWaitingGameTable(): Promise<GameTableData[]> {
    const tableIds = await this.transientDBService.getActiveTableIds();
    const tableData: GameTableData[] = [];
    await Promise.all(
      tableIds.map(async (tableId) => {
        const data = await this.getGameTablePlayersFromTable(tableId);
        if (data[0].gameStatus === GameStatus.waiting) {
          tableData.push(data[0]);
        }
      }),
    );
    return tableData;
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
      ({ playerId, userId, playerInfo, active }) => ({
        playerId,
        userId,
        username: playerInfo.username,
        active,
      }),
    );
    return [
      {
        tableId: table.tableId,
        tableType: table.tableType,
        roundNo: table.roundNo,
        totalRounds: table.totalRounds,
        gameStatus: table.gameStatus,
        players: playersData,
        updatedAt: table.updatedAt,
      },
    ];
  }

  async clearTable(tableId: string) {
    try {
      await this.redisService.aquireLock(tableId);
      const table = await this.tableService.getTableOrThrowException(tableId);
      const userIds = table.players.map((player) => player.userId);
      await this.cbrGameplayGateway.destroyInactiveTable(tableId);
      for (const userId of userIds) {
        await this.transientDBService.deleteUserActiveTableId(userId);
      }
      await this.transientDBService.deleteActiveTable(tableId);
    } catch (error) {
      this.logger.error(`Error Occured during clearing table: ${error}`);
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId);
    }
  }
}
