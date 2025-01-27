import { RedisOptions } from 'ioredis';
import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { config } from '@lib/fabzen-common/configuration';

import {
  AviatorGameplayTrasporterController,
  AviatorGameplaySocketGateway,
  JobQueueHandler,
} from '.';
import { UsecasesModule } from '../../domain/use-cases/use-cases.module';
import { RepositoryModule } from '../repositories';

@Module({})
export class AviatorGameplayControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    const redisOption: RedisOptions = {
      host: config.redis.adapter.host,
      port: config.redis.adapter.port,
    };

    return {
      module: AviatorGameplayControllersModule,
      imports: [
        UsecasesModule.forRoot(mongoUri),
        RemoteConfigModule,
        RepositoryModule,
        BullModule.forRoot({
          redis: redisOption,
        }),
        BullModule.registerQueue({
          name: 'aviator',
        }),
      ],
      controllers: [AviatorGameplayTrasporterController],
      providers: [AviatorGameplaySocketGateway, JobQueueHandler],
      exports: [AviatorGameplaySocketGateway],
    };
  }
}
