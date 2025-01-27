import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { RedisOptions } from 'ioredis';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { config } from '@lib/fabzen-common/configuration';
import {
  SLGameplayGateway,
  SLGameTrasporterController,
  JobQueueHandler,
} from '.';
import { UsecasesModule } from '../../domain/use-cases';

@Module({})
export class SLGameControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    const redisOption: RedisOptions = {
      host: config.redis.adapter.host,
      port: config.redis.adapter.port,
    };
    return {
      module: SLGameControllersModule,
      imports: [
        RemoteConfigModule,
        BullModule.forRoot({
          redis: redisOption,
        }),
        BullModule.registerQueue({
          name: 'snakeAndLadders',
        }),
        UsecasesModule.forRoot(mongoUri),
      ],
      controllers: [SLGameTrasporterController],
      providers: [SLGameplayGateway, JobQueueHandler],
      exports: [SLGameplayGateway],
    };
  }
}
