import { NestFactory } from '@nestjs/core';
import { ReGameplayModule } from './re-gameplay.module';
import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { App } from '@lib/fabzen-common/types';
import { Logger } from '@nestjs/common';
import { RedisIoAdapter } from './services/transient-db/redis/adapter';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.create(ReGameplayModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: getServiceConfig(App.reGameplay),
  });
  app.enableCors();
  const { publicPort } = config.reGameplay;
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  await app.startAllMicroservices();
  await app.listen(publicPort);
  logger.log(`Rummy Empire Gameplay Service is running on Port ${publicPort}`);
}
// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
