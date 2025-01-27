import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { LockerService } from '@lib/fabzen-common/locker/locker.service';

import { GameTimerOption } from './types';
import { TURN_TIMEOUT_IN_SECONDS } from '../entities/constants';
import { LudoMegaTournamentGameplayUseCases } from './gameplay.use-cases';
import { LudoMegaTournamentGameTableRepository } from '../interfaces';
import { GameAction } from '../entities';

@Injectable()
export class LudoMegaTournamentGameTimerUseCases {
  constructor(
    private readonly gameTableRepository: LudoMegaTournamentGameTableRepository,
    @Inject(forwardRef(() => LudoMegaTournamentGameplayUseCases))
    private readonly gameplayUseCases: LudoMegaTournamentGameplayUseCases,
    private readonly lockerService: LockerService,
  ) {}

  public async startGameTimer(option: GameTimerOption) {
    const { delayInSeconds } = option;
    const delay = (delayInSeconds ?? TURN_TIMEOUT_IN_SECONDS) * 1000;
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
      const { counter } = gameTable;
      await this.lockerService.releaseLock(tableId);
      if (counter >= targetCounter) {
        return;
      }
      switch (action) {
        case GameAction.startGame: {
          return this.gameplayUseCases.handleReadyToStart(tableId);
        }
        case GameAction.skipTurn: {
          return this.gameplayUseCases.handleSkipTurn(tableId);
        }
        case GameAction.endGame: {
          return this.gameplayUseCases.handleEndGame(tableId);
        }
      }
    } catch {}
  }
}
