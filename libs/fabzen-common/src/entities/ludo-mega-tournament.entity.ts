import * as dayjs from 'dayjs';
import { BadRequestException } from '@nestjs/common';

import {
  LudoMegaTournamentStatus,
  LudoMegaTournamentWinningPrize,
} from '../types';
import { PawnPosition } from 'apps/ludo-mega-tournament/src/domain/entities';

export class LudoMegaTournamentEntity {
  constructor(
    public id: string,
    public name: string,
    public alias: string,
    public deepLink: string,
    public joinFee: string,
    public status: LudoMegaTournamentStatus,
    public createdAt: dayjs.Dayjs,
    public endAt: dayjs.Dayjs,
    public winningPrizes: LudoMegaTournamentWinningPrize[],
    public maxTotalEntries: number,
    public maxEntriesPerUser: number,
    public extensionTime: number,
    public maxExtensionLimit: number,
    public extendedCount: number,
    public enteredUserCount: number,
    public totalPrizePool: string,
    public totalWinners: number,
    public isRepeatable: boolean,
    public myEntryCount: number,
    public myHighestScore: number,
    public highestScore: number,
    public totalWinAmount: string,
    public useSamePawnPositions: boolean,
    public pawnPositions: PawnPosition[],
    public totalMoves: number,
  ) {}

  public shouldBeExtended(): boolean {
    return this.status === LudoMegaTournamentStatus.live;
  }

  public canBeExtended(): boolean {
    return this.extendedCount < this.maxExtensionLimit;
  }

  public canBeCanceled(): boolean {
    return (
      this.status === LudoMegaTournamentStatus.live ||
      this.status === LudoMegaTournamentStatus.closed
    );
  }

  public readyToFinalize(): boolean {
    return (
      this.status === LudoMegaTournamentStatus.full ||
      this.status === LudoMegaTournamentStatus.closed
    );
  }

  public checkIfJoinable(userEntryCount: number): boolean {
    if (this.status !== LudoMegaTournamentStatus.live) {
      throw new BadRequestException(`Tournament ${this.name} is not live`);
    }

    if (userEntryCount >= this.maxEntriesPerUser) {
      throw new BadRequestException(
        `User has reached max entries for tournament ${this.id}`,
      );
    }

    if (this.enteredUserCount >= this.maxTotalEntries) {
      throw new BadRequestException(`Tournament ${this.name} is Full`);
    }

    return true;
  }

  public isFull(): boolean {
    return this.maxTotalEntries <= this.enteredUserCount;
  }
}
