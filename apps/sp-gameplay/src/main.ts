import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SpGameplayModule } from './sp-gameplay.module';
import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { App } from '@lib/fabzen-common/types';
import { RedisIoAdapter } from './services/transient-db/redis/adapter';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.create(SpGameplayModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: getServiceConfig(App.spGameplay),
  });
  app.enableCors();
  const { publicPort } = config.spGameplay;
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  await app.startAllMicroservices();
  await app.listen(publicPort);
  logger.log(`Skillpatti Gameplay Service is running on Port ${publicPort}`);
}
// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
