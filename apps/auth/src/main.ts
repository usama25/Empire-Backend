import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { AuthModule } from './auth.module';

const logger = new Logger('main');

async function bootstrap() {
  const { host, port } = getServiceConfig(App.auth);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthModule.forRoot(config.mongodb.mongoUri),
    {
      transport: Transport.TCP,
      options: { host, port },
    },
  );
  await app.listen();
  logger.log(`Auth Service is running on Port ${port}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
