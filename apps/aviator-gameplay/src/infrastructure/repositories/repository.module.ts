import { Module } from '@nestjs/common';

import { RedisConnectionOptions } from '@lib/fabzen-common/redis/types';
import { config } from '@lib/fabzen-common/configuration';
import { RedisModule } from '@lib/fabzen-common/redis/module';

import { RedisAviatorGameTableRepository } from './redis-game.repository';
import { AviatorRoundRepository } from '../../domain/interfaces';

const redisConnectionOption: RedisConnectionOptions = config.aviator.redis;

@Module({
  imports: [RedisModule.forRoot(redisConnectionOption)],
  providers: [
    {
      provide: AviatorRoundRepository,
      useClass: RedisAviatorGameTableRepository,
    },
  ],
  exports: [AviatorRoundRepository],
})
export class RepositoryModule {}
