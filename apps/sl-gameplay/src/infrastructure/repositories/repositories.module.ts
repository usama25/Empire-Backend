import { Module } from '@nestjs/common';

import { RedisModule } from '@lib/fabzen-common/redis/module';

import { SLMatchingQueueService } from '../../domain/interfaces/queue.service';
import { SLRedisMatchingQueueService } from './redis-queue.repository';
import { RedisConnectionOptions } from '@lib/fabzen-common/redis/types';
import { config } from '@lib/fabzen-common/configuration';
import { SLGameTableRepository } from '../../domain/interfaces';
import { RedisSLGameTableRepository } from './redis-game.repository';
const redisConnectionOption: RedisConnectionOptions = config.slGameplay.redis;

@Module({
  imports: [RedisModule.forRoot(redisConnectionOption)],
  providers: [
    {
      provide: SLMatchingQueueService,
      useClass: SLRedisMatchingQueueService,
    },
    {
      provide: SLGameTableRepository,
      useClass: RedisSLGameTableRepository,
    },
  ],
  exports: [SLMatchingQueueService, SLGameTableRepository],
})
export class RepositoryModule {}
