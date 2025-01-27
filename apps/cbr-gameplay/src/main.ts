import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { RedisIoAdapter } from './redis/adapter';
import { CbrGameplayModule as CallbackGameplayModule } from './cbr-gameplay.module';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.create(CallbackGameplayModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: getServiceConfig(App.cbrGameplay),
  });
  app.enableCors();
  const { publicPort } = config.cbrGameplay;
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  await app.startAllMicroservices();
  await app.listen(publicPort);
  logger.log(`Callbreak Gameplay Service is running on Port ${publicPort}`);
}
// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
