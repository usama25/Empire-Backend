import { Queue } from 'bull';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';

import { AviatorGameplaySocketGateway } from '.';

// type BullJob<T> = {
//   data: T;
// };

@Processor('aviator')
@Injectable()
export class JobQueueHandler {
  constructor(
    private readonly socketGateway: AviatorGameplaySocketGateway,
    @InjectQueue('aviator')
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
}
