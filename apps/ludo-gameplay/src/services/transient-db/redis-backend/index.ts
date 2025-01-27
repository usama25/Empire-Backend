import * as dayjs from 'dayjs';
import { ChainableCommander } from 'ioredis';
import * as duration from 'dayjs/plugin/duration';
import { Injectable, Logger } from '@nestjs/common';

import {
  TableID,
  TournamentID,
  UserID,
  Table,
} from '../../../ludo-gameplay.types';
import { RedisService } from '../../redis/service';

import { TransientDBService } from '..';
import { config } from '@lib/fabzen-common/configuration';

dayjs.extend(duration);

const {
  userActiveTableKey,
  activeTableKey,
  userWaitingTableKey,
  userTournamentKey,
  userNotMatchedKey,
  promotedUserKey,
  discardedUserKey,
  bigTableKey,
} = config.ludoGameplay.redis;

@Injectable()
export class RedisTransientDBService implements TransientDBService {
  private readonly logger = new Logger(RedisTransientDBService.name);

  constructor(private readonly redisService: RedisService) {}

  getRedisPipeline(): ChainableCommander {
    return this.redisService.client.pipeline();
  }

  async getUserActiveTableId(userId: UserID): Promise<TableID | undefined> {
    return this.redisService.getValue<TableID>(userActiveTableKey, userId);
  }

  async setUserActiveTableId(userId: UserID, tableId: TableID) {
    await this.redisService.setValue(userActiveTableKey, userId, tableId);
  }

  async deleteUserActiveTableId(userId: UserID) {
    await this.redisService.deleteKey(userActiveTableKey, userId);
  }

  async getUserTournamentId(userId: UserID): Promise<TournamentID | undefined> {
    return this.redisService.getValue<TournamentID>(userTournamentKey, userId);
  }

  async setUserTournamentId(userId: UserID, tournamentId: TournamentID) {
    await this.redisService.setValue(userTournamentKey, userId, tournamentId);
  }

  async deleteUserTournamentId(userId: TournamentID) {
    await this.redisService.deleteKey(userTournamentKey, userId);
  }

  async getActiveTable(tableId: TableID): Promise<Table | undefined> {
    return this.redisService.getValue<Table>(activeTableKey, tableId, true);
  }

  async getActiveTables(tableIds: TableID[]): Promise<Map<TableID, Table>> {
    const tablesInRawString = await this.redisService.getMultipleValues(
      activeTableKey,
      tableIds,
    );
    tablesInRawString.filter(Boolean);
    const tableMap = new Map<TableID, Table>();
    for (const tableInRawString of tablesInRawString) {
      const table = JSON.parse(tableInRawString) as Table;
      tableMap.set(table.tableInfo.tableId, table);
    }
    return tableMap;
  }

  async setActiveTable(table: Table) {
    await this.redisService.setValue(
      activeTableKey,
      table.tableInfo.tableId,
      table,
    );
  }

  async deleteActiveTable(tableId: TableID) {
    await this.redisService.deleteKey(activeTableKey, tableId);
  }

  async getUserWaitingQueueName(userId: UserID): Promise<string | undefined> {
    return this.redisService.getValue<string>(userWaitingTableKey, userId);
  }

  async setUserWaitingQueueName(userId: UserID, queueName: string) {
    return this.redisService.setValue(userWaitingTableKey, userId, queueName);
  }

  async deleteUserWaitingTable(userId: UserID) {
    await this.redisService.deleteKey(userWaitingTableKey, userId);
  }

  async checkIfUserNotMatched(userId: UserID): Promise<boolean> {
    return (
      (await this.redisService.getValue<string>(userNotMatchedKey, userId)) ===
      '1'
    );
  }

  async setUserNotMatchedKey(userId: UserID, needSet: boolean) {
    await (needSet
      ? this.redisService.setValue(userNotMatchedKey, userId, 1)
      : this.redisService.deleteKey(userNotMatchedKey, userId));
  }

  async getPromotedUser(
    tournamentId: TournamentID,
  ): Promise<UserID | undefined> {
    return this.redisService.getValue<UserID>(promotedUserKey, tournamentId);
  }

  async setPromotedUser(tournamentId: TournamentID, userId: UserID) {
    await this.redisService.setValue(promotedUserKey, tournamentId, userId);
  }

  async deletePromotedUser(tournamentId: TournamentID) {
    await this.redisService.deleteKey(promotedUserKey, tournamentId);
  }

  async getDiscardedUser(userId: UserID): Promise<TableID | undefined> {
    return this.redisService.getValue<TableID>(discardedUserKey, userId);
  }

  async setDiscardedUser(userId: UserID, tableId: UserID) {
    await this.redisService.setValue(discardedUserKey, userId, tableId);
  }

  async deleteDiscardedUser(userId: UserID) {
    await this.redisService.deleteKey(discardedUserKey, userId);
  }

  async setBigTableUser(userId: UserID) {
    await this.redisService.setValue(bigTableKey, userId, 1);
  }

  async deleteBigTableUser(userId: UserID) {
    await this.redisService.deleteKey(bigTableKey, userId);
  }

  async getBigTableUsers(): Promise<string[]> {
    return await this.redisService.getKeys(bigTableKey);
  }
}
