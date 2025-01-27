import { DynamicModule, Module } from '@nestjs/common';

import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { GatewayModule } from '../../infrastructure/gateways/';
import { RepositoryModule } from '../../infrastructure/repositories';

import {
  LudoMegaTournamentUseCases,
  LudoMegaTournamentGameTimerUseCases,
  LudoMegaTournamentGameplayUseCases,
} from '.';
import { LockerModule } from '@lib/fabzen-common/locker/locker.module';
import { RedisConnectionOptions } from '@lib/fabzen-common/redis/types';
import { config } from '@lib/fabzen-common/configuration';

const redisConnectionOption: RedisConnectionOptions =
  config.ludoMegaTournament.redis;

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [
        MongooseModule.forRoot(mongoUri),
        GatewayModule,
        RepositoryModule,
        RemoteConfigModule,
        LockerModule.forRoot(redisConnectionOption),
      ],
      providers: [
        LudoMegaTournamentUseCases,
        LudoMegaTournamentGameplayUseCases,
        LudoMegaTournamentGameTimerUseCases,
      ],
      exports: [
        LudoMegaTournamentUseCases,
        LudoMegaTournamentGameplayUseCases,
        LudoMegaTournamentGameTimerUseCases,
      ],
    };
  }
}
