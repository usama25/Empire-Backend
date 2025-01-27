import { EPLGameTable } from '../entities';

export abstract class EPLGameTableRepository {
  abstract retrieveGameTable(tableId: string): Promise<EPLGameTable>;

  abstract storeGameTable(
    table: EPLGameTable,
    shouldCacheForUser?: boolean,
  ): Promise<void>;

  abstract deleteGameTable(tableId: string, userIds: string[]): Promise<void>;

  abstract deleteUserTableCache(userId: string): Promise<void>;

  abstract retrieveUserActiveTable(
    userId: string,
  ): Promise<EPLGameTable | undefined>;

  abstract retrieveUserActiveTableId(userId: string): Promise<string>;

  abstract getActiveTableIds(): Promise<string[]>;

  abstract getActiveTable(tableId: string): Promise<EPLGameTable | undefined>;

  abstract flushRedis(): Promise<void>;
}
