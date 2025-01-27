import { Controller, forwardRef, Get, Inject } from '@nestjs/common';
import { UserID, JoinTableRequest } from '@lib/fabzen-common/types';

import { SpGameplayService } from './sp-gameplay.service';
import { SpGameplayGateway } from './sp-gameplay.gateway';
import { SPLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';
import * as dayjs from 'dayjs';

type StatusResponse = {
  status: string;
};

@Controller()
export class SpGameplayController {
  isReady: Promise<boolean>;
  constructor(
    @Inject(forwardRef(() => SpGameplayService))
    private readonly spGameplayService: SpGameplayService,
    @Inject(forwardRef(() => SpGameplayGateway))
    private readonly spGameplayGateway: SpGameplayGateway,
  ) {}

  /**
   * Basic REST service health check
   */
  @Get()
  getStatus(): StatusResponse {
    return { status: 'OK' };
  }

  async joinTable(joinTableRequest: JoinTableRequest) {
    return await this.spGameplayService.joinTable(joinTableRequest);
  }

  async leaveWaitingTable(userId: UserID, isEmit?: boolean) {
    await this.spGameplayService.leaveWaitingTable(userId, isEmit);
  }

  async getGameTables(spLiveGamesRequest: SPLiveGamesRequest) {
    const { tableId, userId, amount, skip, count } = spLiveGamesRequest;
    let gameTables = await this.spGameplayService.getGameTable(
      tableId,
      userId,
      amount,
    );
    gameTables = gameTables.slice(skip, skip + count);
    let stuckTables = gameTables.filter(
      (table) => table.updatedAt && dayjs().diff(table.updatedAt) >= 60_000,
    );
    const stuckTableCount = stuckTables.length;
    stuckTables = stuckTables.slice(skip, skip + count);
    const totalGameData = await this.spGameplayService.getGameTable();
    return {
      gameTables,
      stuckTables,
      stuckTableCount,
      tableCount: totalGameData.length,
      playerCount: totalGameData.reduce(
        (accumulator, table) => accumulator + table.players.length,
        0,
      ),
    };
  }

  async clearTable(tableId: string) {
    try {
      await this.spGameplayGateway.destroyInactiveTable(tableId);
    } catch {
      throw new Error('Failed to clear table');
    }
  }
}
