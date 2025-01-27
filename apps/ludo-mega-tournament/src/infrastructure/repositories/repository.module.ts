import { Module } from '@nestjs/common';

import { RedisConnectionOptions } from '@lib/fabzen-common/redis/types';
import { config } from '@lib/fabzen-common/configuration';
import { RedisModule } from '@lib/fabzen-common/redis/module';

import { RedisLudoMegaTournamentGameTableRepository } from './redis-game.repository';
import { LudoMegaTournamentGameTableRepository } from '../../domain/interfaces';

const redisConnectionOption: RedisConnectionOptions =
  config.ludoMegaTournament.redis;

@Module({
  imports: [RedisModule.forRoot(redisConnectionOption)],
  providers: [
    {
      provide: LudoMegaTournamentGameTableRepository,
      useClass: RedisLudoMegaTournamentGameTableRepository,
    },
  ],
  exports: [LudoMegaTournamentGameTableRepository],
})
export class RepositoryModule {}
