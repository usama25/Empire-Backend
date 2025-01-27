import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { LockerModule } from '@lib/fabzen-common/locker/locker.module';
import { RedisConnectionOptions } from '@lib/fabzen-common/redis/types';
import { config } from '@lib/fabzen-common/configuration';
import { EPLGameMatchingQueueUseCases } from './matching-queue.usecases';
import { EPLGameplayUseCases } from './gameplay.usecases';
import { RepositoryModule } from '../../infrastructure/repositories/repositories.module';
import { EPLGameTimerUseCases } from './game-timer.usecases';
import { GatewayModule } from '../../infrastructure/gateways/gateway.module';
import { WalletModule } from 'apps/wallet/src/wallet.module';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { UserModule } from 'apps/user/src/user.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

const redisConnectionOption: RedisConnectionOptions = config.eplGameplay.redis;

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
        WalletModule,
        UserModule,
        EventEmitterModule.forRoot(),
      ],
      providers: [
        EPLGameMatchingQueueUseCases,
        EPLGameplayUseCases,
        EPLGameTimerUseCases,
        WalletProvider,
      ],
      exports: [
        EPLGameMatchingQueueUseCases,
        EPLGameplayUseCases,
        EPLGameTimerUseCases,
      ],
    };
  }
}
