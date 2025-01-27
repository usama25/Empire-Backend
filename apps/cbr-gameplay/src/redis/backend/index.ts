import * as dayjs from 'dayjs';
import * as duration from 'dayjs/plugin/duration';
import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';
import { TableType, Table, WaitingInfo } from '../../cbr-gameplay.types';
import { RedisService } from '../service';
import { isEmpty } from 'lodash';

dayjs.extend(duration);

const {
  userActiveTableKey,
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
  tablePrefix,
  processStatus,
  bigTableKey,
} = config.cbrGameplay.redis;

@Injectable()
export class RedisTransientDBService {
  private readonly logger = new FbzLogger(RedisTransientDBService.name);

  constructor(
    @Inject(forwardRef(() => RedisService))
    private readonly redisService: RedisService,
  ) {}

  async getUserActiveTableId(userId: string): Promise<string | undefined> {
    return this.redisService.getValue<string>(userActiveTableKey, userId);
  }

  async setUserActiveTableId(userId: string, tableId: string) {
    await this.redisService.setValue(userActiveTableKey, userId, tableId);
  }

  async deleteUserActiveTableId(userId: string) {
    await this.redisService.deleteKey(userActiveTableKey, userId);
  }

  async getActiveTable(tableId: string): Promise<Table | undefined> {
    return this.redisService.getValue<Table>(activeTableKey, tableId, true);
  }

  async getActiveTableIds(): Promise<string[]> {
    return this.redisService.getKeys(activeTableKey);
  }

  async setActiveTable(table: Table) {
    await this.redisService.setValue(activeTableKey, table.tableId, table);
  }

  async deleteActiveTable(tableId: string) {
    await this.redisService.deleteKey(activeTableKey, tableId);
  }

  async getUserLock(userId: string): Promise<boolean> {
    return (
      (await this.redisService.getValue<string>(userLockKey, userId)) === '1'
    );
  }

  async setUserLock(userId: string, lock: boolean) {
    await (lock
      ? this.redisService.setValue(userLockKey, userId, 1)
      : this.redisService.deleteKey(userLockKey, userId));
  }

  async getTableLock(tableId: string): Promise<boolean> {
    return (
      (await this.redisService.getValue<string>(tableLockKey, tableId)) === '1'
    );
  }

  async setTableLock(tableId: string, lock: boolean) {
    await (lock
      ? this.redisService.setValue(tableLockKey, tableId, 1)
      : this.redisService.deleteKey(tableLockKey, tableId));
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

  async getWaitingTableLock(tableType: TableType): Promise<boolean> {
    const field = this.getWaitingTableKey(tableType);
    return (
      (await this.redisService.getValue<string>(waitingTableLockKey, field)) ===
      '1'
    );
  }

  async setWaitingTableLock(tableType: TableType, lock: boolean) {
    const field = this.getWaitingTableKey(tableType);
    await this.redisService.setValue(
      waitingTableLockKey,
      field,
      lock ? '1' : '0',
    );
  }

  async getWaitingTable(
    tableType: TableType,
  ): Promise<WaitingInfo | undefined> {
    const field = this.getWaitingTableKey(tableType);
    return this.redisService.getValue<WaitingInfo>(waitingTableKey, field);
  }

  async getPublicWaitingTable(
    tableType: TableType,
  ): Promise<Table | undefined> {
    const field = this.getPublicWaitingTableKey(tableType);
    return this.redisService.getValue<Table | undefined>(
      waitingTableKey,
      field,
      true,
    );
  }

  async setPublicWaitingTable(tableType: TableType, table: Table) {
    const field = this.getPublicWaitingTableKey(tableType);
    await this.redisService.setValue(waitingTableKey, field, table);
  }

  async setWaitingTable(tableType: TableType, waitingTable: WaitingInfo) {
    const field = this.getWaitingTableKey(tableType);
    await this.redisService.setValue(waitingTableKey, field, waitingTable);
  }

  async deleteWaitingTable(tableType: TableType) {
    const field = this.getPublicWaitingTableKey(tableType);
    await this.redisService.deleteKey(waitingTableKey, field);
  }

  async getUserWaitingTable(userId: string): Promise<WaitingInfo | undefined> {
    return this.redisService.getValue<WaitingInfo>(
      userWaitingTableKey,
      userId,
      true,
    );
  }

  async getUserWaitingTableKeys(): Promise<string[]> {
    return this.redisService.getKeys(userWaitingTableKey);
  }

  async setUserWaitingTable(userId: string, waitingTable: WaitingInfo) {
    return this.redisService.setValue(
      userWaitingTableKey,
      userId,
      waitingTable,
    );
  }

  async getUserQueueKeys(queueName: string): Promise<string[]> {
    return this.redisService.getKeys(queueName);
  }

  async setTableQueueData(tableId: string, pid: string, value: string) {
    const tableKey = tablePrefix + tableId;
    const pidData: any = await this.getTableQueueData(tableId, pid);
    if (
      (!pidData && value !== processStatus.created) ||
      (pidData === processStatus.created && value === processStatus.created) ||
      (pidData && pidData !== processStatus.created)
    ) {
      return;
    }
    await this.redisService.setValue(tableKey, pid, value);

    // const pids = await this.redisService.getKeys(tableKey);
  }

  async getTableQueueData(tableId: string, pid: string) {
    const tableKey = tablePrefix + tableId;
    return await this.redisService.getValue(tableKey, pid);
  }

  async deleteTableQueueData(tableId: string, pid?: string) {
    const tableKey = tablePrefix + tableId;
    await this.redisService.deleteKey(tableKey, pid);

    // const pids = await this.redisService.getKeys(tableKey);
  }

  async getTableQueuePids(tableId: string) {
    const tableKey = tablePrefix + tableId;
    return await this.redisService.getKeys(tableKey);
  }

  async getTableQueueValues(tableId: string) {
    const tableKey = tablePrefix + tableId;
    return await this.redisService.getVals(tableKey);
  }

  async deleteUserWaitingTable(userId: string) {
    await this.redisService.deleteKey(userWaitingTableKey, userId);
  }

  async blockUser(userId: string) {
    const key = `${blockedUserKey}:${userId}`;
    // const isBlocked = this.redisService.getValue(key);
    const expireAfterSeconds = dayjs
      .duration(config.auth.jwt.expiration)
      .asSeconds();
    await this.redisService.setValue(key, '', 1, expireAfterSeconds);
  }

  async unblockUser(userId: string) {
    const key = `${blockedUserKey}:${userId}`;
    await this.redisService.deleteKey(key);
  }

  async getStuckTable() {
    return await this.redisService.getKeys(stuckTableId);
  }

  async storeStuckTable(tableId: string) {
    return await this.redisService.setValue(stuckTableId, tableId, 1);
  }

  async checkIfUserBlocked(userId: string) {
    const key = `${blockedUserKey}:${userId}`;
    return this.redisService.keyExists(key);
  }

  private getPublicWaitingTableKey(tableType: TableType) {
    return `public${tableType.tableTypeId}tableTypeId`;
  }

  private getWaitingTableKey({ tableTypeId, amount }: TableType) {
    return `tableTypeId${tableTypeId}amount${amount}`;
  }

  async setBigTableUser(userId: string) {
    await this.redisService.setValue(bigTableKey, userId, 1);
  }

  async deleteBigTableUser(userId: string) {
    await this.redisService.deleteKey(bigTableKey, userId);
  }

  async getBigTableUsers(): Promise<string[]> {
    return await this.redisService.getKeys(bigTableKey);
  }
}
