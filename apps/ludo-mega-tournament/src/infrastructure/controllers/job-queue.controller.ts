import { Queue } from 'bull';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { BullQueueJob } from '@lib/fabzen-common/types/bull-queue.types';

import { LudoMegaTournamentSocketGateway } from '.';
import { LudoMegaTournamentUseCases } from '../../domain/use-cases';

@Processor('ludoMegaTournament')
@Injectable()
export class JobQueueHandler {
  constructor(
    private readonly tournamentUseCases: LudoMegaTournamentUseCases,
    private readonly socketGateway: LudoMegaTournamentSocketGateway,
    @InjectQueue('ludoMegaTournament')
    private queue: Queue,
  ) {
    this.queue.add(
      'onlineUserCount',
      {},
      {
        repeat: {
          cron: config.socketGateway.broadcastOnlineUserCountCronExpr,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  @Process('onlineUserCount')
  async handleOnlineUserCount() {
    await this.socketGateway.broadcastOnlineUserCount();
  }

  @Process('closeTournament')
  async handleEndTournament(job: BullQueueJob<{ tournamentId: string }>) {
    const tournamentId = job.data.tournamentId;
    await this.tournamentUseCases.closeTournament(tournamentId);
  }
}
