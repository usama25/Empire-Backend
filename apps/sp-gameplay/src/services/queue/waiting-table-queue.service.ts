/* eslint-disable @typescript-eslint/no-unused-vars */
import * as dayjs from 'dayjs';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { config } from '@lib/fabzen-common/configuration';
import {
  Currency,
  UserID,
  GameTypes,
  SubWallet,
  TableType,
} from '@lib/fabzen-common/types';
import { RedisService } from '../transient-db/redis/service';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

import {
  getGameConfig,
  getNoPlayers,
  leaveLogs,
} from '../../utils/sp-gameplay.utils';
import { SpGameplayService } from '../../sp-gameplay.service';
import { RedisTransientDBService } from '../transient-db/redis-backend';
import { SpGameplayGateway } from '../../sp-gameplay.gateway';
import { CommonService, TableService } from '../gameplay';
import { delay } from '@lib/fabzen-common/utils/time.utils';

const {
  userActiveTableKey,
  tableQueueLock,
  configKey,
  processStatus,
  tableQueuePid,
  queueLockKey,
} = config.spGameplay.redis.keyPrefixes;
const {
  getConfigIntervalInMs,
  schedulingIntervalInMs,
  tableQueueIntervalInMs,
} = config.spGameplay;

@Injectable()
export class WaitingTableQueueService {
  private schedulers = new Map<string, NodeJS.Timer>();
  constructor(
    @Inject(forwardRef(() => SpGameplayService))
    private readonly spGameplayService: SpGameplayService,
    @Inject(forwardRef(() => CommonService))
    private readonly commonService: CommonService,
    @Inject(forwardRef(() => TableService))
    private readonly tableService: TableService,
    private readonly spGameplayGateway: SpGameplayGateway,
    private readonly redisService: RedisService,
    private readonly remoteConfigService: RemoteConfigService,
    private readonly transientDBService: RedisTransientDBService,
  ) {}

  createScheduler(tableType: TableType) {
    const queueName = this.getQueueName(tableType);
    const scheduler = setInterval(() => {
      this.match(tableType);
    }, schedulingIntervalInMs);

    this.schedulers.set(queueName, scheduler);
  }

  getScheduler(tableType: TableType): NodeJS.Timer | undefined {
    const queueName = this.getQueueName(tableType);
    return this.schedulers.get(queueName);
  }

  destroyScheduler(tableType: TableType, currency: Currency) {
    const queueName = this.getQueueName(tableType);
    const scheduler = this.schedulers.get(queueName);
    if (scheduler) {
      // clearInterval(scheduler);
      this.schedulers.delete(queueName);
    }
  }

  getConfigSchedule() {
    return this.schedulers.get(configKey);
  }

  createConfigSchedule() {
    const scheduler = setInterval(async () => {
      await this.updateConfigAndCheckTable();
    }, getConfigIntervalInMs);

    this.schedulers.set(configKey, scheduler);
  }

  async updateConfigAndCheckTable() {
    // check if table is stuck
    const activeTableIds = await this.redisService.getKeys(userActiveTableKey);
    activeTableIds.map(async (tableId) => {
      const table = await this.transientDBService.getActiveTable(tableId);
      if (table?.updated && dayjs().diff(dayjs(table?.updated)) >= 40_000) {
        this.commonService.sendNotification(tableId, table?.updated);
        if (table) {
          table.locked = true;
          await this.transientDBService.setActiveTable(table);
        }
      }
    });

    // const tableIds = await this.redisService.getTableKeys();
    // let tableTypes = await this.redisService.getKeys(queueLockKey);
    // tableTypes = tableTypes.filter((tableType) => tableType !== tableQueueLock);

    // Promise.all([
    //   ...tableTypes.map(async (tableType) => {
    //     const lockTime = await this.redisService.getValue<string>(
    //       queueLockKey,
    //       tableType,
    //     );
    //     if (lockTime && dayjs().diff(dayjs(lockTime)) >= 6000) {
    //       this.commonService.sendQueueNotification(tableType);
    //     }
    //   }),
    //   ...tableIds.map(async (tableId) => {
    //     const pids = await this.transientDBService.getTableQueuePids(tableId);
    //     if (!pids || isEmpty(pids)) {
    //       return;
    //     }
    //     const values =
    //       await this.transientDBService.getTableQueueValues(tableId);
    //     if (values[0] && dayjs().diff(dayjs(values[0])) >= 5000) {
    //       this.commonService.sendNotification(tableId, values[0]);
    //       const table = await this.transientDBService.getActiveTable(tableId);
    //       if (table) {
    //         table.locked = true;
    //         await this.transientDBService.setActiveTable(table);
    //       }
    //     }
    //   }),
    // ]);

    // await this.spGameplayGateway.sendOnlineUserCount();
  }

  getTableQueueSchedule() {
    return this.schedulers.get(tableQueuePid);
  }

  createTableQueueSchedule() {
    const scheduler = setInterval(() => {
      this.processTable();
    }, tableQueueIntervalInMs);

    this.schedulers.set(tableQueuePid, scheduler);
  }

  async addToTableQueue(tableId: string, pid: string) {
    // if (!this.getTableQueueSchedule()) {
    //   this.createTableQueueSchedule();
    // }
    await this.transientDBService.setTableQueueData(
      tableId,
      pid,
      dayjs().toISOString(),
    );
  }

  async processTable() {
    try {
      const tableLock = await this.transientDBService.getTableQueueLock();
      if (tableLock) {
        leaveLogs('table id lock', { tableLock });
        return;
      }
      await this.transientDBService.setTableQueueLock(true);
      // const tableIds = await this.redisService.getTableKeys();

      // if (tableIds.length === 0) {
      //   await this.transientDBService.setTableQueueLock(false);
      //   return;
      // }

      // let tableTypes = await this.redisService.getKeys(queueLockKey);
      // tableTypes = tableTypes.filter(
      //   (tableType) => tableType !== tableQueueLock,
      // );

      // await Promise.all([
      //   tableIds.map(async (tableId) => {
      //     const pids = await this.transientDBService.getTableQueuePids(tableId);
      //     if (!pids || isEmpty(pids)) {
      //       return;
      //     }
      //     const values =
      //       await this.transientDBService.getTableQueueValues(tableId);
      //     if (values.every((value) => value === processStatus.created)) {
      //       await this.transientDBService.setTableQueueData(
      //         tableId,
      //         pids[0],
      //         dayjs().toISOString(),
      //       );
      //     } else {
      //       const readyTime = values.find(
      //         (value) => value !== processStatus.created,
      //       );
      //       if (readyTime && dayjs().diff(dayjs(readyTime)) >= 3000) {
      //         this.commonService.sendNotification(tableId, readyTime);
      //         const table =
      //           await this.transientDBService.getActiveTable(tableId);
      //         if (table) {
      //           table.locked = true;
      //           await this.transientDBService.setActiveTable(table);
      //         }
      //       }
      //     }
      //   }),
      //   tableTypes.map(async (tableType) => {
      //     const lockTime = await this.redisService.getValue<string>(
      //       queueLockKey,
      //       tableType,
      //     );
      //     if (lockTime && dayjs().diff(dayjs(lockTime)) >= 5000) {
      //       this.commonService.sendQueueNotification(tableType);
      //     }
      //   }),
      // ]);
    } catch (error) {
      throw error;
    } finally {
      await this.transientDBService.setTableQueueLock(false);
    }
  }

  destroyTableScheduler() {
    const scheduler = this.schedulers.get(tableQueueLock);
    if (scheduler) {
      // clearInterval(scheduler);
      this.schedulers.delete(tableQueueLock);
    }
  }

  async addToQueue(
    tableType: TableType,
    userId: UserID,
    amount: SubWallet,
    walletBalance: SubWallet,
    isMaintenanceBypass: boolean,
  ) {
    const queueName = this.getQueueName(tableType);
    // if (!this.getScheduler(tableType)) {
    //   this.createScheduler(tableType);
    // }
    // if (!this.getConfigSchedule()) {
    //   this.createConfigSchedule();
    // }
    const matchingTimeout = getGameConfig(tableType).matchingTimeout;
    const expiresAt = dayjs().add(matchingTimeout, 'seconds');

    await Promise.all([
      this.transientDBService.setUserQueueData(queueName, userId, {
        userId,
        amount,
        walletBalance,
        isMaintenanceBypass,
        expiry: expiresAt.unix(),
      }),
      this.transientDBService.setUserWaitingTable(userId, {
        tableType,
        timeout: expiresAt.toISOString(),
      }),
    ]);

    await this.spGameplayGateway.handleJoinUser(tableType, 1);

    // FIX ME: logs
    // const userQueueKeys = await this.transientDBService.getUserQueueKeys(
    //   queueName,
    // );
    // const userWaitingTableKeys =
    //   await this.transientDBService.getUserWaitingTableKeys();
    // console.log('waiting info', { userQueueKeys, userWaitingTableKeys });
  }

  async removeFromQueue(tableType: TableType, userId: UserID) {
    const queueName = this.getQueueName(tableType);
    // wait until queue unlocked
    while (await this.transientDBService.getQueueLock(tableType.tableTypeId)) {
      // this.logger.log('queue lock for removeFromQueue', tableType.tableTypeId);
      delay(10);
    }
    this.redisService.deleteKey(queueName, userId);
    this.transientDBService.deleteUserWaitingTable(userId);
    this.spGameplayGateway.handleLeaveUser(tableType, 1);
  }

  async isUserOnQueue(tableType: TableType, userId: UserID): Promise<boolean> {
    const queueName = this.getQueueName(tableType);
    const userWaitingInfo = await this.redisService.getValue(queueName, userId);
    // false if no key or expiry is 0
    return !!userWaitingInfo;
  }

  async match(tableType: TableType) {
    const queueName = this.getQueueName(tableType);
    const noPlayers = getNoPlayers(tableType);
    const userIds = await this.redisService.getKeys(queueName);
    const userArray = await Promise.all(
      userIds.map((userId) =>
        this.transientDBService.getUserQueueData(queueName, userId),
      ),
    );
    userArray.sort((a, b) => a.expiry - b.expiry);
    const readyUsers = [],
      leftUserIds = [],
      expiredUserIds = [],
      matchedUserIds = [];
    for (const {
      userId,
      expiry,
      walletBalance,
      amount,
      isMaintenanceBypass,
    } of userArray) {
      if (expiry === 0) {
        leftUserIds.push(userId);
      } else if (dayjs().isAfter(dayjs.unix(expiry))) {
        expiredUserIds.push(userId);
      } else {
        readyUsers.push({
          userId,
          walletBalance,
          expiry,
          amount,
          isMaintenanceBypass,
        });
      }
    }

    if (leftUserIds.length > 0) {
      Promise.all(
        leftUserIds.map((userId) =>
          this.spGameplayGateway.leftWaitingTable(userId, true),
        ),
      );
    }

    if (await this.transientDBService.getQueueLock(queueName)) {
      // console.log('queue lock', { queueName });
      return;
    }
    this.transientDBService.setQueueLock(queueName, true);
    try {
      // join tables that have empty seats
      let emptySeatTables: any[] = [];
      if (readyUsers.length > 0) {
        emptySeatTables = await this.tableService.getEmptySeatTables(tableType);
      }
      let tableIndex = 0;

      while (
        emptySeatTables.length > 0 &&
        readyUsers.length > 0 &&
        tableType.gameType === GameTypes.multiplayer
      ) {
        if (emptySeatTables[tableIndex].players.length === noPlayers) {
          tableIndex++;
        }
        const emptySeatNumber =
          noPlayers - emptySeatTables[tableIndex].players.length;
        const joinUserNo = Math.min(emptySeatNumber, readyUsers.length);

        const joiningUsers = readyUsers.splice(0, joinUserNo);
        leaveLogs('joinExistingTable - enter queue', {
          users: joiningUsers,
          table: emptySeatTables[tableIndex],
        });

        const userIdsToBeMatched = joiningUsers.map((user) => user.userId);
        matchedUserIds.push(...userIdsToBeMatched);

        await this.commonService.joinExistingTable(
          joiningUsers,
          emptySeatTables[tableIndex].tableId,
        );

        emptySeatTables = await this.tableService.getEmptySeatTables(tableType);
      }

      while (readyUsers.length >= 2) {
        const usersToBeMatched = readyUsers.splice(
          0,
          Math.min(readyUsers.length, noPlayers),
        );
        const userIdsToBeMatched = usersToBeMatched.map((user) => user.userId);
        leaveLogs('create table - queue matched', { usersToBeMatched });
        await this.spGameplayService.createNewTable({
          tableType,
          users: usersToBeMatched,
        });
        matchedUserIds.push(...userIdsToBeMatched);
      }

      // decrement users count with no opponents
      if (leftUserIds.length + expiredUserIds.length > 0) {
        await this.spGameplayGateway.handleLeaveUser(
          tableType,
          leftUserIds.length + expiredUserIds.length,
        );
      }
    } catch (error) {
      console.log(
        'waiting queue exception',
        JSON.stringify(error),
        error.message,
      );
      throw error;
    } finally {
      await Promise.all([
        ...[...matchedUserIds, ...leftUserIds, ...expiredUserIds].map(
          (userId) => this.redisService.deleteKey(queueName, userId),
        ),
        ...[...matchedUserIds, ...leftUserIds, ...expiredUserIds].map(
          (userId) => this.transientDBService.deleteUserWaitingTable(userId),
        ),
      ]);
      for (const userId of expiredUserIds) {
        console.log('expiredUserIds', expiredUserIds);
        if (
          Number(tableType.minJoinAmount) >=
          Number(
            this.remoteConfigService.getSpMatchMakingNotificationConfig()
              .minimumJoinAmountForNotifications,
          )
        ) {
          await this.transientDBService.setBigTableUser(userId);
        }
      }
      this.transientDBService.setQueueLock(queueName, false);
    }
  }

  private getQueueName(tableType: TableType): string {
    return tableType.tableTypeId;
  }
}
