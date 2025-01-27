/* eslint-disable @typescript-eslint/no-unused-vars */
import * as dayjs from 'dayjs';
import * as duration from 'dayjs/plugin/duration';
import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import {
  TableType,
  Table,
  WaitingInfo,
  TableID,
  UserID,
  Currency,
  UserQueueData,
} from '@lib/fabzen-common/types';

import { RedisService } from '../redis/service';
import { TransientDBService } from '..';
import { getWaitingTableKey } from '../../../utils/waiting-table-key.utils';
import { isEmpty } from 'lodash';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { customAlphabet } from 'nanoid';
import {
  ReTable,
  ReTableId,
  ReWaitingInfo,
} from 'apps/re-gameplay/src/re-gameplay.types';

dayjs.extend(duration);

const {
  userActiveTableKey,
  userSocketKey,
  userCountKey,
  activeTableKey,
  waitingTableKey,
  userWaitingTableKey,
  userLockKey,
  tableLockKey,
  queueLockKey,
  tableQueueLock,
  waitingTableLockKey,
  blockedUserKey,
  stuckTableId,
  configKey,
  tablePrefix,
  processStatus,
  matchingNoKey,
} = config.reGameplay.redis.keyPrefixes;

@Injectable()
export class RedisTransientDBService implements TransientDBService {
  private readonly remoteConfigService: RemoteConfigService;
  private tableLock: any = {};

  constructor(
    @Inject(forwardRef(() => RedisService))
    private readonly redisService: RedisService,
  ) {}

  async getUserActiveTableId(userId: UserID): Promise<TableID | undefined> {
    return this.redisService.getValue<TableID>(userActiveTableKey, userId);
  }

  async setUserActiveTableId(userId: UserID, tableId: TableID) {
    await this.redisService.setValue(userActiveTableKey, userId, tableId);
  }

  async deleteUserActiveTableId(userId: UserID) {
    await this.redisService.deleteKey(userActiveTableKey, userId);
  }

  async deleteReUserActiveTableId(userId: UserID) {
    await this.redisService.deleteKey(userActiveTableKey, userId);
  }

  async getUserSocketId(userId: UserID): Promise<string | undefined> {
    return this.redisService.getValue<string>(userSocketKey, userId);
  }

  async setUserSocketId(userId: UserID, socketId: string) {
    await this.redisService.setValue(userSocketKey, userId, socketId);
  }

  async deleteUserSocketId(userId: UserID) {
    await this.redisService.deleteKey(userSocketKey, userId);
  }

  async getActiveTable(tableId: TableID): Promise<Table | undefined> {
    return this.redisService.getValue<Table>(activeTableKey, tableId, true);
  }

  async getActiveReTable(tableId: ReTableId): Promise<ReTable | undefined> {
    return this.redisService.getValue<ReTable>(activeTableKey, tableId, true);
  }

  async getActiveTableIds(): Promise<TableID[]> {
    return this.redisService.getKeys(activeTableKey);
  }

  async setActiveTable(table: Table) {
    await this.redisService.setValue(activeTableKey, table.tableId, table);
  }

  async setActiveReTable(table: ReTable) {
    await this.redisService.setValue(activeTableKey, table.tableId, table);
  }

  async deleteActiveTable(tableId: TableID) {
    await this.redisService.deleteKey(activeTableKey, tableId);
  }

  async deleteActiveReTable(tableId: ReTableId) {
    await this.redisService.deleteKey(activeTableKey, tableId);
  }

  async getUserLock(userId: UserID): Promise<boolean> {
    return (
      (await this.redisService.getValue<string>(userLockKey, userId)) === '1'
    );
  }

  async setUserLock(userId: UserID, lock: boolean) {
    await (lock
      ? this.redisService.setValue(userLockKey, userId, 1)
      : this.redisService.deleteKey(userLockKey, userId));
  }

  async getTableLock(tableId: TableID): Promise<string> {
    // await this.redisService.increment('lock', 'lock', 1);
    const pid = customAlphabet(config.spGameplay.alphaNumberics, 12)();
    this.tableLock[pid] = 1;
    // let lock = await this.redisService.getValue('lock', 'lock');
    while (Object.keys(this.tableLock)[0] !== pid) {
      await delay(5);
    }

    return pid;
    // return (
    //   (await this.redisService.getValue<string>(tableLockKey, tableId)) === '1'
    // );
  }

  async setTableLock(tableId: TableID, pid: string) {
    delete this.tableLock[pid];
    // await this.redisService.increment('lock', 'lock', -1);
    // await (lock
    //   ? this.redisService.setValue(tableLockKey, tableId, 1)
    //   : this.redisService.deleteKey(tableLockKey, tableId));
  }

  async getTableLockCount(tableId: TableID) {
    return Number(await this.redisService.getValue(tableLockKey, tableId));
  }

  async getQueueLock(queueName: string): Promise<boolean> {
    return !isEmpty(
      await this.redisService.getValue<string>(queueLockKey, queueName),
    );
  }

  async getTableQueueLock(): Promise<boolean> {
    return (
      (await this.redisService.getValue<string>(
        queueLockKey,
        tableQueueLock,
      )) === '1'
    );
  }

  async setTableQueueLock(lock: boolean) {
    lock
      ? await this.redisService.setValue(queueLockKey, tableQueueLock, 1)
      : await this.redisService.deleteKey(queueLockKey, tableQueueLock);
  }

  async setQueueLock(queueName: string, lock: boolean) {
    await (lock
      ? this.redisService.setValue(
          queueLockKey,
          queueName,
          dayjs().toISOString(),
        )
      : this.redisService.deleteKey(queueLockKey, queueName));
  }

  async getWaitingTableLock(
    tableType: TableType,
    currency: Currency,
  ): Promise<boolean> {
    const field = getWaitingTableKey(tableType, currency);
    return (
      (await this.redisService.getValue<string>(waitingTableLockKey, field)) ===
      '1'
    );
  }

  async setWaitingTableLock(
    tableType: TableType,
    currency: Currency,
    lock: boolean,
  ) {
    const field = getWaitingTableKey(tableType, currency);
    await this.redisService.setValue(
      waitingTableLockKey,
      field,
      lock ? '1' : '0',
    );
  }

  async getWaitingTable(
    tableType: TableType,
    currency: Currency,
  ): Promise<WaitingInfo | undefined> {
    const field = getWaitingTableKey(tableType, currency);
    return this.redisService.getValue<WaitingInfo>(waitingTableKey, field);
  }

  async setWaitingTable(
    tableType: TableType,
    currency: Currency,
    waitingTable: WaitingInfo,
  ) {
    const field = getWaitingTableKey(tableType, currency);
    await this.redisService.setValue(waitingTableKey, field, waitingTable);
  }

  async deleteWaitingTable(tableType: TableType, currency: Currency) {
    const field = getWaitingTableKey(tableType, currency);
    await this.redisService.deleteKey(waitingTableKey, field);
  }

  async getUserWaitingTable(userId: UserID): Promise<WaitingInfo | undefined> {
    return this.redisService.getValue<WaitingInfo>(
      userWaitingTableKey,
      userId,
      true,
    );
  }

  async getReUserWaitingTable(
    userId: UserID,
  ): Promise<ReWaitingInfo | undefined> {
    return this.redisService.getValue<ReWaitingInfo>(
      userWaitingTableKey,
      userId,
      true,
    );
  }

  async getUserWaitingTableKeys(): Promise<string[]> {
    return this.redisService.getKeys(userWaitingTableKey);
  }

  async setUserWaitingTable(userId: UserID, waitingTable: WaitingInfo) {
    return this.redisService.setValue(
      userWaitingTableKey,
      userId,
      waitingTable,
    );
  }

  async setReUserWaitingTable(userId: UserID, waitingTable: ReWaitingInfo) {
    return this.redisService.setValue(
      userWaitingTableKey,
      userId,
      waitingTable,
    );
  }

  async setUserQueueData(
    queueName: string,
    userId: string,
    userQueueData: UserQueueData,
  ) {
    await this.redisService.setValue(queueName, userId, userQueueData);
  }

  async getUserQueueData(
    queueName: string,
    userId: string,
  ): Promise<UserQueueData> {
    return (await this.redisService.getValue(
      queueName,
      userId,
      true,
    )) as UserQueueData;
  }

  async getUserQueueKeys(queueName: string): Promise<string[]> {
    return this.redisService.getKeys(queueName);
  }

  async setTableQueueData(tableId: string, pid: string, value: string) {
    const tableKey = tablePrefix + tableId;
    await this.redisService.setValue(tableKey, pid, value);
  }

  async getTableQueueData(tableId: string, pid: string) {
    const tableKey = tablePrefix + tableId;
    return await this.redisService.getValue(tableKey, pid);
  }

  async deleteTableQueueData(tableId: string, pid?: string) {
    const tableKey = tablePrefix + tableId;
    await this.redisService.deleteKey(tableKey, pid);
  }

  async getTableQueuePids(tableId: string) {
    const tableKey = tablePrefix + tableId;
    return await this.redisService.getKeys(tableKey);
  }

  async getTableQueueValues(tableId: string) {
    const tableKey = tablePrefix + tableId;
    return await this.redisService.getVals(tableKey);
  }

  async deleteUserWaitingTable(userId: UserID) {
    await this.redisService.deleteKey(userWaitingTableKey, userId);
  }

  async deleteReUserWaitingTable(userId: string) {
    await this.redisService.deleteKey(userWaitingTableKey, userId);
  }

  async incrementMatchingCount(userId: string, matchingNo: number) {
    await this.redisService.increment(matchingNoKey, userId, matchingNo);
    return (await this.redisService.getValue(matchingNoKey, userId)) as number;
  }

  async getUserMatchingCount(userId: string): Promise<string> {
    let matchingNo: string = (await this.redisService.getValue(
      matchingNoKey,
      userId,
    )) as string;
    if (matchingNo === undefined || matchingNo === null) {
      matchingNo = '0';
    }

    return matchingNo;
  }

  async setUserMatchingCount(userId: string, matchingNo: number) {
    await this.redisService.setValue(matchingNoKey, userId, matchingNo);
  }

  async incrementUserCount(tableTypeId: string, userNo: number) {
    await this.redisService.increment(userCountKey, tableTypeId, userNo);
    return (await this.redisService.getValue(
      userCountKey,
      tableTypeId,
    )) as number;
  }

  async getUserCount(tableTypeId: string): Promise<string> {
    let userNo: string = (await this.redisService.getValue(
      userCountKey,
      tableTypeId,
    )) as string;
    if (userNo === undefined || userNo === null) {
      userNo = '0';
    }

    return userNo;
  }

  async setUserCount(tableTypeId: string, userNo: number) {
    await this.redisService.setValue(userCountKey, tableTypeId, userNo);
  }

  async blockUser(userId: UserID) {
    const key = `${blockedUserKey}:${userId}`;
    const isBlocked = this.redisService.getValue(key);
    const expireAfterSeconds = dayjs
      .duration(config.auth.jwt.expiration)
      .asSeconds();
    await this.redisService.setValue(key, '', 1, expireAfterSeconds);
  }

  async unblockUser(userId: UserID) {
    const key = `${blockedUserKey}:${userId}`;
    await this.redisService.deleteKey(key);
  }

  async getStuckTable() {
    return await this.redisService.getKeys(stuckTableId);
  }

  async storeStuckTable(tableId: string) {
    return await this.redisService.setValue(stuckTableId, tableId, 1);
  }

  async checkIfUserBlocked(userId: UserID) {
    const key = `${blockedUserKey}:${userId}`;
    return this.redisService.keyExists(key);
  }
}
