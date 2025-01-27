import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import {
  config,
  getServicesInfoToConnect,
} from '@lib/fabzen-common/configuration';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { App } from '@lib/fabzen-common/types';

import { CbrGameplayGateway } from './cbr-gameplay.gateway';
import { CbrGameplayService } from './cbr-gameplay.service';
import { CommonService, TableService } from './services/gameplay';
import { RedisTransientDBService } from './redis/backend';
import { RedisService } from './redis/service';
import { CbrQueueService } from './services/queue/cbr-queue.service';
import { CbrGameplayTransporterController } from './cbr-gameplay.transporter.controller';

@Module({
  imports: [
    RemoteConfigModule,
    MongooseModule.forRoot(config.mongodb.mongoUri),
    ClientsModule.register({
      clients: getServicesInfoToConnect(App.cbrGameplay),
      isGlobal: true,
    }),
    EnvironmentModule,
  ],
  controllers: [CbrGameplayTransporterController],
  providers: [
    CbrGameplayGateway,
    CbrGameplayService,
    CommonService,
    TableService,
    RedisTransientDBService,
    RedisService,
    CbrQueueService,
  ],
})
export class CbrGameplayModule {}
