import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App, Games } from '@lib/fabzen-common/types';
import { RedisIoAdapter } from '@lib/fabzen-common/redis/adapter';

import { AviatorGameplayModule } from './aviator-gameplay.module';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.create(
    AviatorGameplayModule.forRoot(config.mongodb.mongoUri),
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: getServiceConfig(App.aviator),
  });
  app.enableCors();
  const { publicPort } = config.aviator;
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(Games.aviator);
  app.useWebSocketAdapter(redisIoAdapter);
  await app.startAllMicroservices();
  await app.listen(publicPort);
  logger.log(`Aviator Gameplay Service is running on Port ${publicPort}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
