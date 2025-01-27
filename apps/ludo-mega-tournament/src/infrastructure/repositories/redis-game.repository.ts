import { Injectable, NotFoundException } from '@nestjs/common';

import { RedisService } from '@lib/fabzen-common/redis/module';

import { LudoMegaTournamentGameTableRepository } from '../../domain/interfaces';
import { LudoMegaTournamentGameTable } from '../../domain/entities';
import { TABLE_KEY, USER_TABLE_CACHE_KEY } from './constants';

@Injectable()
export class RedisLudoMegaTournamentGameTableRepository
  implements LudoMegaTournamentGameTableRepository
{
  constructor(private readonly redisService: RedisService) {}

  async retrieveGameTable(
    tableId: string,
  ): Promise<LudoMegaTournamentGameTable> {
    const serializedTable = await this.redisService.getValue<string>(
      TABLE_KEY,
      tableId,
    );
    if (!serializedTable) {
      throw new NotFoundException(`Table ${tableId} Not Found`);
    }
    return LudoMegaTournamentGameTable.deserialize(serializedTable);
  }

  async storeGameTable(
    table: LudoMegaTournamentGameTable,
    shouldCacheForUser?: boolean,
  ): Promise<void> {
    const serializedTable = table.serialze();
    const { id, userId } = table;
    await this.redisService.setValue(TABLE_KEY, id, serializedTable);
    if (shouldCacheForUser) {
      await this.redisService.setValue(USER_TABLE_CACHE_KEY, userId, id);
    }
  }

  async deleteGameTable(tableId: string, userId: string): Promise<void> {
    await this.redisService.deleteKey(TABLE_KEY, tableId);
    await this.redisService.deleteKey(USER_TABLE_CACHE_KEY, userId);
  }

  async retrieveUserActiveTable(
    userId: string,
  ): Promise<LudoMegaTournamentGameTable | undefined> {
    const tableId = await this.retrieveUserActiveTableId(userId);
    if (!tableId) {
      return;
    }
    return await this.retrieveGameTable(tableId);
  }

  async retrieveUserActiveTableId(userId: string): Promise<string | undefined> {
    return await this.redisService.getValue<string>(
      USER_TABLE_CACHE_KEY,
      userId,
    );
  }
}
