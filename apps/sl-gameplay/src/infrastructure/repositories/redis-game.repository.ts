import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '@lib/fabzen-common/redis/module';
import { SLGameTableRepository } from '../../domain/interfaces';
import { SLGameTable } from '../../domain/entities';
import { TABLE_KEY_PREFIX, USER_TABLE_CACHE_KEY } from './constants';

@Injectable()
export class RedisSLGameTableRepository implements SLGameTableRepository {
  constructor(private readonly redisService: RedisService) {}

  async retrieveGameTable(tableId: string): Promise<SLGameTable> {
    const serializedTable = await this.redisService.getValue<string>(
      TABLE_KEY_PREFIX,
      tableId,
    );
    if (!serializedTable) {
      throw new NotFoundException(`Table${tableId} Not Found`);
    }
    return SLGameTable.deserialize(serializedTable);
  }

  async retrieveGameTable_(tableId: string) {
    const serializedTable = await this.redisService.getValue<string>(
      TABLE_KEY_PREFIX,
      tableId,
    );
    if (!serializedTable) {
      return;
    }
    return SLGameTable.deserialize(serializedTable);
  }
  async storeGameTable(
    table: SLGameTable,
    shouldCacheForUser?: boolean,
  ): Promise<void> {
    const serializedTable = table.serialize();
    const { id, users } = table;
    await this.redisService.setValue(TABLE_KEY_PREFIX, id, serializedTable);
    if (shouldCacheForUser) {
      for (const user of users) {
        await this.redisService.setValue(USER_TABLE_CACHE_KEY, user.userId, id);
      }
    }
  }

  async getActiveTableIds(): Promise<string[]> {
    return this.redisService.getKeys(TABLE_KEY_PREFIX);
  }

  async getActiveTable(tableId: string): Promise<SLGameTable | undefined> {
    const table = await this.retrieveGameTable_(tableId);
    return table;
  }

  async deleteGameTable(tableId: string, userIds: string[]): Promise<void> {
    await this.redisService.deleteKey(TABLE_KEY_PREFIX, tableId);
    for (const userId of userIds) {
      await this.redisService.deleteKey(USER_TABLE_CACHE_KEY, userId);
    }
  }

  async deleteUserTableCache(userId: string) {
    await this.redisService.deleteKey(USER_TABLE_CACHE_KEY, userId);
  }

  async retrieveUserActiveTable(
    userId: string,
  ): Promise<SLGameTable | undefined> {
    const tableId = await this.retrieveUserActiveTableId(userId);

    if (tableId === '') {
      return;
    }
    const table = await this.retrieveGameTable_(tableId);
    return table;
  }

  async retrieveUserActiveTableId(userId: string): Promise<string> {
    const tableId = await this.redisService.getValue<string>(
      USER_TABLE_CACHE_KEY,
      userId,
    );
    if (!tableId) {
      return '';
    }
    return tableId;
  }

  async flushRedis(): Promise<void> {
    await this.redisService.flushRedis();
  }
}
