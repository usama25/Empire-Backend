import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App, Games } from '@lib/fabzen-common/types';
import { RedisIoAdapter } from '@lib/fabzen-common/redis/adapter';

import { SlGameplayModule } from './sl-gameplay.module';

async function bootstrap() {
  const app = await NestFactory.create(
    SlGameplayModule.forRoot(config.mongodb.mongoUri),
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: getServiceConfig(App.slGameplay),
  });
  app.enableCors();
  const { publicPort } = config.slGameplay;
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(Games.snakeAndLadders);
  app.useWebSocketAdapter(redisIoAdapter);
  await app.startAllMicroservices();
  await app.listen(publicPort);
  console.log(`SL Gameplay Service is running on Port ${publicPort}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
