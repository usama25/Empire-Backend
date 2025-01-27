import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { RedisOptions } from 'ioredis';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { config } from '@lib/fabzen-common/configuration';
import { EPLGameplayGateway } from './socket.gateway';
import { JobQueueHandler } from './job-queue.controller';
import { EPLGameTrasporterController } from './transporter.controller';
import { UsecasesModule } from '../../domain/use-cases/use-cases.module';

@Module({})
export class EPLGameControllersModule {
  static forRoot(): DynamicModule {
    const redisOption: RedisOptions = {
      host: config.redis.adapter.host,
      port: config.redis.adapter.port,
    };
    return {
      module: EPLGameControllersModule,
      imports: [
        UsecasesModule.forRoot(config.mongodb.mongoUri),
        RemoteConfigModule,
        BullModule.forRoot({
          redis: redisOption,
        }),
        BullModule.registerQueue({
          name: 'epl',
        }),
      ],
      controllers: [EPLGameTrasporterController],
      providers: [EPLGameplayGateway, JobQueueHandler],
      exports: [EPLGameplayGateway],
    };
  }
}
