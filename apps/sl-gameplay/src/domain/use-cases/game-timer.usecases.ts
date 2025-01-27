import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { GameTimerOption } from './types';
import { SLGameplayUseCases } from './gameplay.usecases ';
import { SLGameTableRepository } from '../interfaces';
import { GameAction } from '../entities';
import { LockerService } from '@lib/fabzen-common/locker/locker.service';

@Injectable()
export class SLGameTimerUseCases {
  constructor(
    private readonly gameTableRepository: SLGameTableRepository,
    @Inject(forwardRef(() => SLGameplayUseCases))
    private readonly gameplayUseCases: SLGameplayUseCases,
    private readonly lockerService: LockerService,
  ) {}

  public async startGameTimer(option: GameTimerOption) {
    const { delayInSeconds } = option;
    const delay = delayInSeconds * 1000;
    setTimeout(async () => {
      this.handleTimeout(option);
    }, delay);
  }

  private async handleTimeout({
    tableId,
    action,
    targetCounter,
  }: GameTimerOption) {
    await this.lockerService.acquireLock(tableId);

    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      const { counter, currentTurn } = gameTable;
      await this.lockerService.releaseLock(tableId);
      if (counter >= targetCounter && action !== GameAction.endGame) {
        return;
      }
      switch (action) {
        case GameAction.next: {
          return this.gameplayUseCases.handleNext(tableId);
        }
        case GameAction.skipTurn: {
          return this.gameplayUseCases.handleSkipTurn(tableId, currentTurn);
        }
        case GameAction.endGame: {
          return this.gameplayUseCases.handleEndGame(tableId);
        }
      }
    } catch {}
  }
}
