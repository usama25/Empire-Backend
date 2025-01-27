import * as dayjs from 'dayjs';
import { Queue } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';

import { ScheduleService } from '../../domain/interfaces';

@Injectable()
export class BullScheduleService implements ScheduleService {
  private readonly logger = new Logger(BullScheduleService.name);

  constructor(
    @InjectQueue('ludoMegaTournament')
    private queue: Queue,
  ) {}

  scheduleTournamentEnd(tournamentId: string, endTime: string) {
    const timeToWaitInMs = dayjs(endTime).diff(dayjs(), 'milliseconds');
    this.queue.add(
      'closeTournament',
      { tournamentId },
      {
        delay: timeToWaitInMs,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
