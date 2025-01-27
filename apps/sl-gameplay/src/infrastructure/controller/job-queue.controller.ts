import { Queue } from 'bull';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { SLGameplayGateway } from './socket.gateway';
import { config } from '@lib/fabzen-common/configuration';

import {
  SLGameMatchingQueueUseCases,
  SLGameplayUseCases,
} from '../../domain/use-cases';
import { BullQueueJob } from '@lib/fabzen-common/types/bull-queue.types';

@Processor('snakeAndLadders')
@Injectable()
export class JobQueueHandler {
  constructor(
    private readonly matchingQueueUsecases: SLGameMatchingQueueUseCases,
    private readonly socketGateway: SLGameplayGateway,
    private readonly slGameplayUseCases: SLGameplayUseCases,
    @InjectQueue('snakeAndLadders') private scheduleQueue: Queue,
  ) {
    this.#startOnlineUserCountJob();
    this.#startMatchingJob();
  }

  #startOnlineUserCountJob() {
    this.scheduleQueue.add(
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

  #startMatchingJob() {
    this.scheduleQueue.add(
      'matching',
      {},
      {
        repeat: {
          every: 500,
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

  @Process('matching')
  handleMatchingInfo() {
    this.matchingQueueUsecases.matchUsers();
  }

  @Process('endGame')
  handleEndGame(job: BullQueueJob<{ tableId: string }>) {
    const tableId = job.data.tableId;
    this.slGameplayUseCases.handleEndGame(tableId);
  }
}
