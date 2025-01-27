import { LudoMegaTournamentGameTable } from '../entities/table.entity';

export abstract class LudoMegaTournamentGameTableRepository {
  abstract retrieveGameTable(
    tableId: string,
  ): Promise<LudoMegaTournamentGameTable>;
  abstract storeGameTable(
    table: LudoMegaTournamentGameTable,
    shouldCacheForUser?: boolean,
  ): Promise<void>;
  abstract deleteGameTable(tableId: string, userId: string): Promise<void>;
  abstract retrieveUserActiveTable(
    userId: string,
  ): Promise<LudoMegaTournamentGameTable | undefined>;
  abstract retrieveUserActiveTableId(
    userId: string,
  ): Promise<string | undefined>;
}
