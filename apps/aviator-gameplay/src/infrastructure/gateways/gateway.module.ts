import { RedisOptions } from 'ioredis';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { config } from '@lib/fabzen-common/configuration';

import { ScheduleService, WalletServiceGateway } from '../../domain/interfaces';
import { MicroserviceWalletServiceGateway } from './microservice-wallet.gateway';
import { BullScheduleService } from './bull-schedule.gateway';

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
      name: 'aviator',
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
  ],
  exports: [WalletServiceGateway, ScheduleService],
})
export class GatewayModule {}
