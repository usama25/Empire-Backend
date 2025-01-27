import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { WalletModule } from './wallet.module';

const logger = new Logger('main');

async function bootstrap() {
  const { mongoUri } = config.mongodb;
  const { host, port } = getServiceConfig(App.wallet);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WalletModule.forRoot(mongoUri),
    {
      transport: Transport.TCP,
      options: { host, port },
    },
  );
  await app.listen();
  logger.log(`Wallet Service is running on Port ${port}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
