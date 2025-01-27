import { Controller, forwardRef, Get, Inject } from '@nestjs/common';
import { UserID } from '@lib/fabzen-common/types';

import { ReGameplayService } from './re-gameplay.service';
import { RELiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';
import * as dayjs from 'dayjs';
import { ReGameStatus } from './re-gameplay.types';

type StatusResponse = {
  status: string;
};

@Controller()
export class ReGameplayController {
  isReady: Promise<boolean>;
  constructor(
    @Inject(forwardRef(() => ReGameplayService))
    private readonly reGameplayService: ReGameplayService,
  ) {}

  /**
   * Basic REST service health check
   */
  @Get()
  getStatus(): StatusResponse {
    return { status: 'OK' };
  }

  async leaveWaitingTable(userId: UserID, isEmit?: boolean) {
    await this.reGameplayService.leaveWaitingTable(userId, isEmit);
  }

  async handleMatchingTime(userId: UserID, matchingNo: string) {
    await this.reGameplayService.handleMatchingTime(userId, matchingNo);
  }

  async getGameTables(reLiveGamesRequest: RELiveGamesRequest) {
    const { tableId, userId, amount, skip, count } = reLiveGamesRequest;
    try {
      let gameTables = await this.reGameplayService.getGameTable(
        tableId,
        userId,
        amount,
      );
      gameTables = gameTables.slice(skip, skip + count);
      let stuckTables = gameTables.filter(
        (table) => table.updatedAt && dayjs().diff(table.updatedAt) >= 120_000,
      );
      const stuckTableCount = stuckTables.length;
      stuckTables = stuckTables.slice(skip, skip + count);

      let waitingTables = gameTables.filter(
        (table) =>
          table.gameStatus === ReGameStatus.waiting ||
          table.gameStatus === ReGameStatus.roundEnded,
      );
      const waitingTableCount = waitingTables.length;
      waitingTables = waitingTables.slice(skip, skip + count);

      let waitingUserCount = 0;
      if (waitingTables.length > 0) {
        waitingTables.map((table) => {
          waitingUserCount += table.players.length;
        });
      }

      const totalGameData = await this.reGameplayService.getGameTable();
      return {
        gameTables,
        tableCount: totalGameData.length,
        stuckTables,
        stuckTableCount,
        playerCount: totalGameData.reduce(
          (accumulator, table) => accumulator + table.players.length,
          0,
        ),
        waitingTables,
        waitingTableCount,
        waitingUserCount,
      };
    } catch (error) {
      console.log('Error occurred at the getGameTables', {
        error,
      });
    }
  }

  async clearTable() {
    // const { tableId } = message.body as MessageBody;
    // try {
    //   await this.spGameplayGateway.destroyInactiveTable(tableId);
    //   return await this.sqs.sendResponse({
    //     requestMsg: message,
    //   });
    // } catch (error) {
    //   this.logger.error('Error occurred at the getGameTables', {
    //     error,
    //   });
    //   await this.sqs.sendErrorResponse({
    //     error,
    //     requestMsg: message,
    //   });
    // }
  }
}
