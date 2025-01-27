import { RedisOptions } from 'ioredis';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { config } from '@lib/fabzen-common/configuration';

import { ScheduleService, WalletServiceGateway } from '../../domain/interfaces';
import { MicroserviceWalletServiceGateway } from './microservice-wallet.gateway';
import { BullScheduleService } from './bull-schedule.gateway';
import { NotificationServiceGateway } from '../../domain/interfaces/notification-service.gateway';
import { MicroserviceNotificationServiceGateway } from './microservice-notification.gateway';

const redisOption: RedisOptions = {
  host: config.redis.adapter.host,
  port: config.redis.adapter.port,
};

@Module({
  imports: [
    BullModule.forRoot({
      redis: redisOption,
    }),
    BullModule.registerQueue({
      name: 'ludoMegaTournament',
    }),
  ],
  providers: [
    {
      provide: WalletServiceGateway,
      useClass: MicroserviceWalletServiceGateway,
    },
    {
      provide: ScheduleService,
      useClass: BullScheduleService,
    },
    {
      provide: NotificationServiceGateway,
      useClass: MicroserviceNotificationServiceGateway,
    },
  ],
  exports: [WalletServiceGateway, ScheduleService, NotificationServiceGateway],
})
export class GatewayModule {}
