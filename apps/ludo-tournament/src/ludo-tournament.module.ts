import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';

import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { App } from '@lib/fabzen-common/types';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import {
  config,
  getServicesInfoToConnect,
} from '@lib/fabzen-common/configuration';

import { RedisService } from 'apps/ludo-gameplay/src/services/redis/service';
import { LudoTournamentController } from './ludo-tournament.controller';
import { RedisTransientDBService } from 'apps/ludo-gameplay/src/services/transient-db/redis-backend';
import { HttpClientModule } from '@lib/fabzen-common/http-client/src';
import { LudoTournamentTransporterController } from './ludo-tournament.transporter.controller';
import { LudoTournamentService } from './ludo-tournament.service';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';

@Module({
  imports: [
    EnvironmentModule,
    MongooseModule.forRoot(config.mongodb.mongoUri),
    ClientsModule.register({
      clients: getServicesInfoToConnect(App.ludoTournament),
      isGlobal: true,
    }),
    HttpClientModule,
    RemoteConfigModule,
  ],
  controllers: [LudoTournamentController, LudoTournamentTransporterController],
  providers: [RedisService, RedisTransientDBService, LudoTournamentService],
})
export class LudoTournamentModule {}
