import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { TableService } from '../gameplay/table.service';

import { GameAction, Table } from '../../cbr-gameplay.types';
import { CbrGameplayGateway } from '../../cbr-gameplay.gateway';

@Injectable()
export class CbrQueueService {
  constructor(
    @Inject(forwardRef(() => TableService))
    private tableService: TableService,
    @Inject(forwardRef(() => CbrGameplayGateway))
    private cbrGameplayGateway: CbrGameplayGateway,
  ) {}

  async addTimeoutAction(
    tableId: string,
    action: GameAction,
    delay: number,
    payload?: any,
  ) {
    setTimeout(async () => {
      const table = (await this.tableService.getTable(tableId)) as Table;
      if (!table) {
        return;
      }

      switch (action) {
        case 'deleteTable': {
          await this.cbrGameplayGateway.deleteTable(tableId);
          break;
        }
        case 'startRound': {
          await this.cbrGameplayGateway.startRound(tableId);
          break;
        }
        case 'afterDealCards': {
          await this.cbrGameplayGateway.handBid(tableId);
          break;
        }
        case 'handBid': {
          if (
            payload.turnNo < 4 &&
            (payload.turnNo === table.turnNo || payload.auto)
          ) {
            await this.cbrGameplayGateway.autoHandBid(tableId);
          }
          break;
        }
        case 'dealCards': {
          await this.cbrGameplayGateway.dealCards(table.tableId);
          break;
        }
        case 'throwCard': {
          if (payload.turnNo === table.turnNo || payload.auto) {
            await this.cbrGameplayGateway.autoThrowCard(tableId);
          }
          break;
        }
        case 'nextHand': {
          await this.cbrGameplayGateway.throwCard(tableId);
          break;
        }
        case 'roundEnded': {
          await this.cbrGameplayGateway.endRound(tableId);
          break;
        }
        case 'endGame': {
          await this.cbrGameplayGateway.gameEnded(tableId);
          break;
        }
      }
    }, delay * 1000);
  }
}
