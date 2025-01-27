import { Module } from '@nestjs/common';

import { RedisModule } from '@lib/fabzen-common/redis/module';

import { EPLMatchingQueueService } from '../../domain/interfaces/queue.service';
import { EPLRedisMatchingQueueService } from './redis-queue.repository';
import { RedisConnectionOptions } from '@lib/fabzen-common/redis/types';
import { config } from '@lib/fabzen-common/configuration';
import { EPLGameTableRepository } from '../../domain/interfaces';
import { RedisEPLGameTableRepository } from './redis-game.repository';
const redisConnectionOption: RedisConnectionOptions = config.eplGameplay.redis;

@Module({
  imports: [RedisModule.forRoot(redisConnectionOption)],
  providers: [
    {
      provide: EPLMatchingQueueService,
      useClass: EPLRedisMatchingQueueService,
    },
    {
      provide: EPLGameTableRepository,
      useClass: RedisEPLGameTableRepository,
    },
  ],
  exports: [EPLMatchingQueueService, EPLGameTableRepository],
})
export class RepositoryModule {}
