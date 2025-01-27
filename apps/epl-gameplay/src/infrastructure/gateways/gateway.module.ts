import { RedisOptions } from 'ioredis';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { config } from '@lib/fabzen-common/configuration';
import { WalletServiceGateway } from '../../domain/interfaces/wallet-service.gateway';
import { MicroserviceWalletServiceGateway } from './microservice-wallet.gateway';

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
      name: 'epl',
    }),
  ],
  providers: [
    {
      provide: WalletServiceGateway,
      useClass: MicroserviceWalletServiceGateway,
    },
  ],
  exports: [WalletServiceGateway],
})
export class GatewayModule {}
