import { RedisOptions } from 'ioredis';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { config } from '@lib/fabzen-common/configuration';

import { NotificationGateway } from '../../domain/interfaces/notification.gateway';
import { MicroserviceNotificationGateway } from './microservice-notification.gateway';
import { ScheduleService } from '../../domain/interfaces';
import { BullScheduleService } from '.';

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
      name: 'snakeAndLadders',
    }),
  ],
  providers: [
    {
      provide: NotificationGateway,
      useClass: MicroserviceNotificationGateway,
    },
    {
      provide: ScheduleService,
      useClass: BullScheduleService,
    },
  ],
  exports: [NotificationGateway, ScheduleService],
})
export class GatewayModule {}
