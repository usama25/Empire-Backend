import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  TableID,
  GameAction,
  GameStatus,
  Table,
  TableWithPid,
} from '@lib/fabzen-common/types';
import { TableService } from '../gameplay/table.service';
import { SpGameplayGateway } from '../../sp-gameplay.gateway';
import { RedisTransientDBService } from '../transient-db/redis-backend';
import { leaveLogs } from '../../utils/sp-gameplay.utils';
import { RedisService } from '../transient-db/redis/service';

/**
 * -- Queue logic --
 * 1. There is one Queue per one table
 * 2. Create new Queue by using spQueueService.createQueue when 'joinTableRes' is emitted
 * 3. Add Job (delayTimer) by using spQueueService.setDelayTimer when 'next' is emitted
 * 4. If 'rollDice' or 'movePawn' is not emitted for timeout (10s) from client, on Queue Job process, server emit rollDiceRes or movePawnRes forcely
 * 5. If 'rollDice' or 'movePawn' is emitted in timeout (10s) from client, clean all job of target Queue by using spQueueService.cleanQueue
 */

@Injectable()
export class SpQueueService {
  constructor(
    @Inject(forwardRef(() => TableService))
    private tableService: TableService,
    @Inject(forwardRef(() => SpGameplayGateway))
    private spGameplayGateway: SpGameplayGateway,
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
      const table = (await this.tableService.getTable(tableId)) as Table;
      if (!table) {
        leaveLogs('table not exist unlock', { action, tableId });
        return;
      }

      switch (action) {
        case 'initialBet': {
          this.spGameplayGateway.initialBet(table.tableId);
          break;
        }
        case 'dealCards': {
          this.spGameplayGateway.dealCards(table.tableId);
          break;
        }
        case 'skipTurn': {
          leaveLogs('skipTurn lock', { tableId, payload });
          const { table: newTable, pid: newPid } =
            await this.tableService.getTableOrThrowException(table.tableId);
          await this.redisService.releaseLock(tableId, newPid);
          leaveLogs('skipTurn unlock', { tableId, newPid });
          if (
            payload.turnNo === newTable.turnNo &&
            payload.roundNo === newTable.roundNo &&
            table.gameStatus !== GameStatus.roundEnded &&
            table.gameStatus !== GameStatus.gameEnded
          ) {
            leaveLogs('skipTurn', {
              turnNo: payload,
              playerId: newTable.currentTurn,
            });
            const userId = newTable.players.find(
              (player) => player.playerId === newTable.currentTurn,
            )?.userId;
            if (!userId) {
              console.log('player not found for skipTurn', { newTable });
              return;
            }
            await this.spGameplayGateway.leaveTable(
              newTable.tableId,
              userId,
              true,
            );
          }
          break;
        }
        case 'next': {
          leaveLogs('next queue lock', { tableId, payload });
          const { table: newTable, pid: newPid } =
            await this.tableService.getTableOrThrowException(table.tableId);
          delete newTable.sideshowAccepted;
          await this.tableService.updateTable(newTable, newPid);
          leaveLogs('next queue unlock', { tableId, newPid });
          if (
            payload.turnNo === newTable.turnNo &&
            payload.roundNo === newTable.roundNo &&
            table.gameStatus !== GameStatus.roundEnded &&
            table.gameStatus !== GameStatus.gameEnded
          ) {
            this.spGameplayGateway.next(table.tableId, payload.isSideshow);
          }
          break;
        }
        case 'startRound': {
          const players = table.players.filter((player) => !player.rebuying);
          if (
            players.length > 1 &&
            table.gameStatus === GameStatus.roundEnded
          ) {
            await this.spGameplayGateway.startRound(table.tableId);
          }
          break;
        }
        case 'startPlaying': {
          const { table: newTable, pid: newPid } =
            (await this.tableService.getTableOrThrowException(
              tableId,
            )) as TableWithPid;
          leaveLogs('startPlaying create', {
            tableId: newTable.tableId,
            pid: newPid,
          });
          if (newTable.gameStatus !== GameStatus.dealCards) {
            leaveLogs('startPlaying gameStatus', { table });
            await this.redisService.releaseLock(tableId, newPid);
            leaveLogs('startPlaying unlock', {
              tableId: newTable.tableId,
              pid: newPid,
            });
            return;
          }
          newTable.gameStatus = GameStatus.playing;
          newTable.roundStartPlayersNo = newTable.players.filter(
            (player) => player.firstCard,
          ).length;
          await this.tableService.updateTable(newTable, newPid);

          leaveLogs('startPlaying unlock', {
            tableId: newTable.tableId,
            pid: newPid,
          });
          this.spGameplayGateway.next(table.tableId);
          break;
        }
        case 'roundEnded': {
          this.spGameplayGateway.gameEnded(table.tableId);
          break;
        }
        case 'endGame': {
          this.spGameplayGateway.endTable(table.tableId);
          break;
        }
        case 'rebuy': {
          this.spGameplayGateway.sendRebuyRequest(
            table,
            payload.userId,
            payload.amount,
            payload.walletBalance,
          );
          break;
        }
        case 'rebuyTimeoutLeave': {
          const playerRebuying = table.players.find(
            (player) => player.userId === payload.userId,
          )?.rebuying;
          if (playerRebuying) {
            this.spGameplayGateway.leaveTable(
              table.tableId,
              payload.userId,
              true,
            );
          }
          break;
        }
        case 'rebuyBalanceLeave': {
          this.spGameplayGateway.leaveTable(table.tableId, payload, true);
          break;
        }
        case 'sideshow': {
          if (
            table.gameStatus === GameStatus.roundEnded ||
            table.gameStatus === GameStatus.gameEnded
          ) {
            leaveLogs('sideshow game status', {
              gameStatus: table.gameStatus,
            });
            return;
          }
          if (
            payload.turnNo === table.turnNo &&
            payload.roundNo === table.roundNo
          ) {
            leaveLogs('sideshow pack loser create', {
              tableId: table.tableId,
            });
            const { table: newTable, pid: newPid } =
              (await this.tableService.getTableOrThrowException(
                tableId,
              )) as TableWithPid;
            leaveLogs('sideshow pack loser lock', {
              tableId: newTable.tableId,
              pid: newPid,
            });
            const nextPlayer = this.tableService.getNextActivePlayer(newTable);
            const nextTurn = nextPlayer.playerId;
            newTable.currentTurn = nextTurn;
            await this.tableService.updateTable(newTable, newPid);
            leaveLogs('sideshow pack loser unlock', {
              tableId: table.tableId,
              pid: newPid,
            });

            this.spGameplayGateway.pack(table.tableId, payload.receiveUserId);
          }
          break;
        }
        case 'sideshowAccept': {
          const { table: newTable, pid: newPid } =
            (await this.tableService.getTableOrThrowException(
              tableId,
            )) as TableWithPid;
          leaveLogs('sideshowAccept create', {
            tableId: newTable.tableId,
            pid: newPid,
          });
          if (
            table.gameStatus === GameStatus.roundEnded ||
            table.gameStatus === GameStatus.gameEnded
          ) {
            leaveLogs('sideshowAccept game status', {
              gameStatus: table.gameStatus,
            });
            await this.redisService.releaseLock(tableId, newPid);
            leaveLogs('sideshowAccept unlock', { tableId, newPid });
            return;
          }
          newTable.gameStatus = GameStatus.playing;
          delete newTable.sideshowAccepted;
          await this.tableService.updateTable(newTable, newPid);
          leaveLogs('sideshowAccept unlock', {
            tableId: newTable.tableId,
            pid: newPid,
          });

          if (payload) {
            await this.spGameplayGateway.pack(table.tableId, payload);
          }
          break;
        }
        case 'sideshowReject': {
          leaveLogs('sideshowReject create', {
            tableId: table.tableId,
          });
          const { table: newTable, pid: newPid } =
            (await this.tableService.getTableOrThrowException(
              tableId,
            )) as TableWithPid;
          leaveLogs('sideshowReject lock', {
            tableId: newTable.tableId,
            pid: newPid,
          });
          if (
            table.gameStatus === GameStatus.roundEnded ||
            table.gameStatus === GameStatus.gameEnded
          ) {
            leaveLogs('sideshowReject game status', {
              gameStatus: table.gameStatus,
            });
            await this.redisService.releaseLock(tableId, newPid);
            leaveLogs('sideshowReject unlock', { tableId, newPid });
            return;
          }
          newTable.gameStatus = GameStatus.playing;
          delete newTable.sideshowAccepted;
          await this.tableService.updateTable(newTable, newPid);

          await this.spGameplayGateway.next(table.tableId, true);
          break;
        }
        // No default
      }
    }, delay * 1000);
  }
}
