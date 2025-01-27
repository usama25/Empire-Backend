import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TableID } from '@lib/fabzen-common/types';
import { TableService } from '../gameplay/table.service';
import { ReGameplayGateway } from '../../re-gameplay.gateway';
import { RedisTransientDBService } from '../transient-db/redis-backend';
import { leaveLogs } from '../../utils/re-gameplay.utils';
import { RedisService } from '../transient-db/redis/service';
import {
  GameAction,
  ReGameStatus,
  ReTableWithPid,
} from '../../re-gameplay.types';

/**
 * -- Queue logic --
 * 1. There is one Queue per one table
 * 2. Create new Queue by using spQueueService.createQueue when 'joinTableRes' is emitted
 * 3. Add Job (delayTimer) by using spQueueService.setDelayTimer when 'next' is emitted
 * 4. If 'rollDice' or 'movePawn' is not emitted for timeout (10s) from client, on Queue Job process, server emit rollDiceRes or movePawnRes forcely
 * 5. If 'rollDice' or 'movePawn' is emitted in timeout (10s) from client, clean all job of target Queue by using spQueueService.cleanQueue
 */

@Injectable()
export class ReQueueService {
  constructor(
    @Inject(forwardRef(() => TableService))
    private tableService: TableService,
    @Inject(forwardRef(() => ReGameplayGateway))
    private reGameplayGateway: ReGameplayGateway,
    @Inject(forwardRef(() => RedisTransientDBService))
    private transientDBService: RedisTransientDBService,
    private redisService: RedisService,
  ) {}

  async addTimeoutAction(
    tableId: TableID,
    action: GameAction,
    delay: number,
    payload?: any,
  ) {
    setTimeout(async () => {
      const { table, pid } =
        (await this.tableService.getReTableOrThrowException(
          tableId,
        )) as ReTableWithPid;
      await this.redisService.releaseLock(tableId, pid);
      if (!table) {
        leaveLogs('table not exist unlock', { action, tableId });
        return;
      }

      switch (action) {
        case 'startRound': {
          if (
            table.players.length >= 2 &&
            table.gameStatus === ReGameStatus.roundEnded
          ) {
            await this.reGameplayGateway.startReRound(table.tableId);
          }
          break;
        }
        case 'dealCards': {
          await this.reGameplayGateway.dealReCards(table.tableId);
          break;
        }
        case 'dropPlayer': {
          console.log(`Drop Player Here: ${payload} TableId: ${table.tableId}`);
          console.log(
            `Compare two TurnNo values here payload: ${payload.turnNo}, turnNo: ${table.turnNo} TableId: ${table.tableId}`,
          );
          if (
            payload &&
            payload.turnNo === table.turnNo &&
            payload.currentTurn === table.currentTurn &&
            payload.roundId === table.roundId
          ) {
            leaveLogs('Drop Players Conditon Satisfied!', {
              payload,
              turnNo: table.turnNo,
            });

            const currentPlayer = table.players.find(
              (player) => player.playerId === table.currentTurn,
            );
            if (!currentPlayer) {
              throw new NotFoundException('Current User not found');
            }

            await this.reGameplayGateway.dropPlayer(
              table.tableId,
              currentPlayer.userId,
              false,
            );
          }
          break;
        }
        case 'finishDeclaration': {
          await this.reGameplayGateway.finishRound(tableId);
          break;
        }
        case 'startPlaying': {
          await this.reGameplayGateway.play(table.tableId);
          break;
        }
        case 'next': {
          await (payload && payload.isReshuffled
            ? this.reGameplayGateway.play(table.tableId, true)
            : this.reGameplayGateway.play(table.tableId));
          break;
        }
        case 'roundEnded': {
          await this.reGameplayGateway.gameReEnded(table.tableId);
          break;
        }
        case 'endGame': {
          await this.reGameplayGateway.endReTable(table.tableId);
          break;
        }
        // No default
      }
    }, delay * 1000);
  }
}
