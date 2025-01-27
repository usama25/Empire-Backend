import { DynamicModule, Module } from '@nestjs/common';

import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { LockerModule } from '@lib/fabzen-common/locker/locker.module';
import { RedisConnectionOptions } from '@lib/fabzen-common/redis/types';
import { config } from '@lib/fabzen-common/configuration';

import { SLGameMatchingQueueUseCases } from './matching-queue.usecases';
import { SLGameplayUseCases } from './gameplay.usecases ';
import { RepositoryModule } from '../../infrastructure/repositories/repositories.module';
import { SLGameTimerUseCases } from './game-timer.usecases';
import { GatewayModule } from '../../infrastructure/gateways/gateway.module';

const redisConnectionOption: RedisConnectionOptions = config.slGameplay.redis;

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [
        MongooseModule.forRoot(mongoUri),
        RemoteConfigModule,
        RepositoryModule,
        GatewayModule,
        LockerModule.forRoot(redisConnectionOption),
      ],
      providers: [
        SLGameMatchingQueueUseCases,
        SLGameplayUseCases,
        SLGameTimerUseCases,
      ],
      exports: [
        SLGameMatchingQueueUseCases,
        SLGameplayUseCases,
        SLGameTimerUseCases,
      ],
    };
  }
}
