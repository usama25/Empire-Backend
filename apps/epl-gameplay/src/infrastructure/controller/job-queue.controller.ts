import { Queue } from 'bull';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { EPLGameplayGateway } from './socket.gateway';
import { EPLGameMatchingQueueUseCases } from '../../domain/use-cases/matching-queue.usecases';

@Processor('epl')
@Injectable()
export class JobQueueHandler {
  constructor(
    private readonly socketGateway: EPLGameplayGateway,
    private readonly matchingQueueUsecases: EPLGameMatchingQueueUseCases,
    @InjectQueue('epl') private scheduleQueue: Queue,
  ) {
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
}
