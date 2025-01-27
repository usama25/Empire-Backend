import { Module } from '@nestjs/common';
import { MongooseModule as NestMongooseModule } from '@nestjs/mongoose';
import { ClientsModule } from '@nestjs/microservices';

import {
  config,
  getServicesInfoToConnect,
} from '@lib/fabzen-common/configuration';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { App } from '@lib/fabzen-common/types';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

import { RedisService } from './services/redis/service';
import { LudoGameplayService } from './ludo-gameplay.service';
import { LudoGameplayController } from './ludo-gameplay.controller';
import { TableService, CommonService } from './services/gameplay';
import { WaitingTableQueueService, LudoQueueService } from './services/queue';
import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { LudoGameplayGateway } from './ludo-gameplay.gateway';
import { GameTable, GameTableSchema } from './model/game-table.schema';
import { LudoGameplayTransporterController } from './ludo-gameplay.transporter.controller';

@Module({
  imports: [
    RemoteConfigModule,
    MongooseModule.forRoot(config.mongodb.mongoUri),
    ClientsModule.register({
      clients: getServicesInfoToConnect(App.ludoGameplay),
      isGlobal: true,
    }),
    NestMongooseModule.forRoot(config.mongodb.mongoUri),
    NestMongooseModule.forFeature([
      { name: GameTable.name, schema: GameTableSchema },
    ]),
    EnvironmentModule,
  ],
  controllers: [LudoGameplayController, LudoGameplayTransporterController],
  providers: [
    LudoGameplayController,
    LudoGameplayGateway,
    LudoGameplayService,
    CommonService,
    WaitingTableQueueService,
    TableService,
    LudoQueueService,
    RedisTransientDBService,
    RedisService,
  ],
})
export class LudoGameplayModule {}
