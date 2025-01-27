import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';

import { SocketGatewayModule } from './socket-gateway.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { App, Games } from '@lib/fabzen-common/types';
import { RedisIoAdapter } from '@lib/fabzen-common/redis/adapter';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.create(SocketGatewayModule);
  const { host, port } = getServiceConfig(App.socketGateway);
  const { publicPort } = config.socketGateway;
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host,
      port,
    },
  });
  app.enableCors();
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(Games.empiregames);
  app.useWebSocketAdapter(redisIoAdapter);
  await app.startAllMicroservices();
  await app.listen(publicPort);
  logger.log(`Fabzen Socket Gateway Service is running on Port ${publicPort}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
