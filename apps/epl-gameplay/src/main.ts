import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App, Games } from '@lib/fabzen-common/types';
import { RedisIoAdapter } from '@lib/fabzen-common/redis/adapter';
import { EplGameplayModule } from './epl-gameplay.module';

async function bootstrap() {
  const app = await NestFactory.create(EplGameplayModule.forRoot());
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: getServiceConfig(App.eplGameplay),
  });
  app.enableCors();
  const { publicPort } = config.eplGameplay;
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(Games.epl);
  app.useWebSocketAdapter(redisIoAdapter);
  await app.startAllMicroservices();
  await app.listen(publicPort);
  console.log(`EPL Gameplay Service is running on Port ${publicPort}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
