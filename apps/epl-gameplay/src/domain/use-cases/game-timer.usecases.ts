import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { GameTimerOption } from './types';
import { EPLGameplayUseCases } from './gameplay.usecases';
import { EPLGameAction, TURN_TIMEOUT_IN_SECONDS } from '../entities';
import { LockerService } from '@lib/fabzen-common/locker/locker.service';

@Injectable()
export class EPLGameTimerUseCases {
  constructor(
    @Inject(forwardRef(() => EPLGameplayUseCases))
    private readonly gameplayUseCases: EPLGameplayUseCases,
    private readonly lockerService: LockerService,
  ) {}

  public async startGameTimer(option: GameTimerOption) {
    const { delayInSeconds } = option;
    const delay = (delayInSeconds ?? TURN_TIMEOUT_IN_SECONDS) * 1000;
    setTimeout(async () => {
      this.handleTimeout(option);
    }, delay);
  }

  private async handleTimeout({ tableId, action }: GameTimerOption) {
    await this.lockerService.acquireLock(tableId);

    try {
      await this.lockerService.releaseLock(tableId);
      switch (action) {
        case EPLGameAction.turnTimeout: {
          return this.gameplayUseCases.handleTurnTimeout(tableId);
        }
        case EPLGameAction.turnResult: {
          return this.gameplayUseCases.handleTurnResult(tableId);
        }
        case EPLGameAction.inningStart: {
          return this.gameplayUseCases.handleInningStart(tableId);
        }
        case EPLGameAction.inningEnd: {
          return this.gameplayUseCases.handleInningEnd(tableId);
        }
        case EPLGameAction.gameEnded: {
          return this.gameplayUseCases.handleGameEnded(tableId);
        }
      }
    } catch {}
  }
}
