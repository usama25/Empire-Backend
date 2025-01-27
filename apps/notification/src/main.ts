import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { NotificationModule } from './notification.module';

const logger = new Logger('main');

async function bootstrap() {
  const { host, port } = getServiceConfig(App.notification);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationModule.forRoot(config.mongodb.mongoUri),
    {
      transport: Transport.TCP,
      options: { host, port },
    },
  );
  await app.listen();
  logger.log(`Notification Service is running on Port ${port}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
