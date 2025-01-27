import { SLGameTable } from '../entities';

export abstract class SLGameTableRepository {
  abstract retrieveGameTable(tableId: string): Promise<SLGameTable>;

  abstract storeGameTable(
    table: SLGameTable,
    shouldCacheForUser?: boolean,
  ): Promise<void>;

  abstract deleteGameTable(tableId: string, userIds: string[]): Promise<void>;

  abstract deleteUserTableCache(userId: string): Promise<void>;

  abstract retrieveUserActiveTable(
    userId: string,
  ): Promise<SLGameTable | undefined>;

  abstract retrieveUserActiveTableId(userId: string): Promise<string>;

  abstract getActiveTableIds(): Promise<string[]>;

  abstract getActiveTable(tableId: string): Promise<SLGameTable | undefined>;

  abstract flushRedis(): Promise<void>;
}
