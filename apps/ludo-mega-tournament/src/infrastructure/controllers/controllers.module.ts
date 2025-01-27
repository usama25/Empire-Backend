import { RedisOptions } from 'ioredis';
import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { config } from '@lib/fabzen-common/configuration';

import {
  LudoMegaTournamentTrasporterController,
  LudoMegaTournamentSocketGateway,
  JobQueueHandler,
} from '.';
import { UsecasesModule } from '../../domain/use-cases/use-cases.module';

@Module({})
export class LudoMegaTournamentControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    const redisOption: RedisOptions = {
      host: config.redis.adapter.host,
      port: config.redis.adapter.port,
    };

    return {
      module: LudoMegaTournamentControllersModule,
      imports: [
        UsecasesModule.forRoot(mongoUri),
        RemoteConfigModule,
        BullModule.forRoot({
          redis: redisOption,
        }),
        BullModule.registerQueue({
          name: 'ludoMegaTournament',
        }),
      ],
      controllers: [LudoMegaTournamentTrasporterController],
      providers: [LudoMegaTournamentSocketGateway, JobQueueHandler],
      exports: [LudoMegaTournamentSocketGateway],
    };
  }
}
