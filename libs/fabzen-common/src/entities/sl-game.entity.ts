// Ludo Mega Tournament Entity with name, alias

import * as dayjs from 'dayjs';
import { SLGameOutCome, SLGameWinningPrize } from '../types';
import { PawnPosition } from 'apps/sl-gameplay/src/domain/entities/types';

export class SLGameEntity {
  constructor(
    public id: string,
    public name: string,
    public tableId: string,
    public roomSize: string,
    public outCome: SLGameOutCome,
    public winLoseAmount: number,
    public createdAt: dayjs.Dayjs,
    public endAt: dayjs.Dayjs,
    public winningPrizes: SLGameWinningPrize[],
    public maxTotalEntries: number,
    public maxEntriesPerUser: number,
    public extensionTime: number,
    public maxExtensionLimit: number,
    public extendedCount: number,
    public enteredUserCount: number,
    public totalPrizePool: string,
    public totalWinners: number,
    public myEntryCount: number,
    public myHighestScore: number,
    public highestScore: number,
    public initialPawnPositions?: PawnPosition[],
  ) {}
}
