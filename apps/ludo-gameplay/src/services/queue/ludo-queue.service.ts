import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import {
  GameAction,
  NextAction,
  PlayerInfo,
  TableID,
} from '../../ludo-gameplay.types';
import { RedisService } from '../redis/service';

import { LudoGameplayGateway } from '../../ludo-gameplay.gateway';
import { CommonService } from '../gameplay/common.service';
import { TableService } from '../gameplay/table.service';
import { config } from '@lib/fabzen-common/configuration';

@Injectable()
export class LudoQueueService {
  private readonly logger = new Logger(LudoQueueService.name);

  constructor(
    @Inject(forwardRef(() => TableService))
    private tableService: TableService,
    @Inject(forwardRef(() => LudoGameplayGateway))
    private ludoGameplayGateway: LudoGameplayGateway,
    @Inject(forwardRef(() => CommonService))
    private commonService: CommonService,
    private readonly redisService: RedisService,
  ) {}

  addTimeoutAction(
    tableId: TableID,
    action: GameAction,
    targetTurn: number,
    delay: number,
    payload?: any,
  ) {
    setTimeout(async () => {
      try {
        await this.redisService.aquireLock(tableId);
        const table = await this.tableService.getTable(tableId);
        if (!table) {
          return;
        }
        const { turnNo } = table.tableState;
        if (turnNo >= targetTurn) {
          return;
        }

        switch (action) {
          case 'rollDice': {
            // First roll Dice
            this.ludoGameplayGateway.next(tableId, payload as NextAction);
            this.addTimeoutAction(
              tableId,
              GameAction.skipTurn,
              turnNo + 1,
              config.ludoGameplay.turnTime,
            );
            break;
          }
          case 'skipTurn': {
            await this.tableService.skipTurn(table);
            break;
          }
          case 'endGame': {
            const winner = payload as PlayerInfo;
            this.commonService.endGame(table, [winner.playerId]);
            break;
          }
          case 'discardGame': {
            this.tableService.discardGame(table);
            break;
          }
        }
      } finally {
        this.redisService.releaseLock(tableId);
      }
    }, delay * 1000);
  }
}
