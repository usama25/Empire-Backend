import { Module } from '@nestjs/common';
import { ReGameplayController } from './re-gameplay.controller';
import { ReGameplayService } from './re-gameplay.service';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import {
  config,
  getServicesInfoToConnect,
} from '@lib/fabzen-common/configuration';
import { ClientsModule } from '@nestjs/microservices';
import { App } from '@lib/fabzen-common/types';
import { ReGameplayTransporterController } from './re-gameplay.transporter.controller';
import { ReGameplayGateway } from './re-gameplay.gateway';
import { CommonService, TableService } from './services/gameplay';
import { ReQueueService, WaitingTableQueueService } from './services/queue';
import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { RedisService } from './services/transient-db/redis/service';

@Module({
  imports: [
    RemoteConfigModule,
    MongooseModule.forRoot(config.mongodb.mongoUri),
    ClientsModule.register({
      clients: getServicesInfoToConnect(App.reGameplay),
      isGlobal: true,
    }),
    EnvironmentModule,
  ],
  controllers: [ReGameplayController, ReGameplayTransporterController],
  providers: [
    ReGameplayController,
    ReGameplayGateway,
    ReGameplayService,
    CommonService,
    WaitingTableQueueService,
    TableService,
    ReQueueService,
    RedisTransientDBService,
    RedisService,
  ],
})
export class ReGameplayModule {}
