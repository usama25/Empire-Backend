import { Module } from '@nestjs/common';
import { RedisService } from './services/transient-db/redis/service';
import { SpGameplayService } from './sp-gameplay.service';
import { SpGameplayController } from './sp-gameplay.controller';
import { TableService, CommonService } from './services/gameplay';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { WaitingTableQueueService, SpQueueService } from './services/queue';
import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { SpGameplayGateway } from './sp-gameplay.gateway';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { ClientsModule } from '@nestjs/microservices';
import {
  config,
  getServicesInfoToConnect,
} from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { SPGameplayTransporterController } from './sp-gameplay.transporter.controller';

@Module({
  imports: [
    RemoteConfigModule,
    MongooseModule.forRoot(config.mongodb.mongoUri),
    ClientsModule.register({
      clients: getServicesInfoToConnect(App.spGameplay),
      isGlobal: true,
    }),
    EnvironmentModule,
  ],
  controllers: [SpGameplayController, SPGameplayTransporterController],
  providers: [
    SpGameplayController,
    SpGameplayGateway,
    SpGameplayService,
    CommonService,
    WaitingTableQueueService,
    TableService,
    SpQueueService,
    RedisTransientDBService,
    RedisService,
  ],
})
export class SpGameplayModule {}
