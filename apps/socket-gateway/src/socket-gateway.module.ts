import { APP_PIPE } from '@nestjs/core';
import { Module, ValidationPipe } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';

import {
  config,
  getServicesInfoToConnect,
} from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';

import { MainGateway } from './gateways';
import { MainSocketGatewayTransporterController } from './main/main.transporter.controller';
import { RedisTransientDBService as SpRedisTransientDBService } from 'apps/sp-gameplay/src/services/transient-db/redis-backend';
import { RedisService as SpRedisService } from 'apps/sp-gameplay/src/services/transient-db/redis/service';
import { RedisTransientDBService as CbrRedisTransientDBService } from 'apps/cbr-gameplay/src/redis/backend';
import { RedisService as CbrRedisService } from 'apps/cbr-gameplay/src/redis/service';
import { RedisTransientDBService as LudoRedisTransientDBService } from 'apps/ludo-gameplay/src/services/transient-db/redis-backend';
import { RedisService as LudoRedisService } from 'apps/ludo-gameplay/src/services/redis/service';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

@Module({
  imports: [
    MongooseModule.forRoot(config.mongodb.mongoUri),
    ClientsModule.register({
      clients: getServicesInfoToConnect(App.socketGateway),
      isGlobal: true,
    }),
    RemoteConfigModule,
    EnvironmentModule,
  ],
  providers: [
    MainGateway,
    SpRedisTransientDBService,
    SpRedisService,
    CbrRedisTransientDBService,
    CbrRedisService,
    LudoRedisTransientDBService,
    LudoRedisService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
      }),
    },
  ],
  controllers: [MainSocketGatewayTransporterController],
})
export class SocketGatewayModule {}
