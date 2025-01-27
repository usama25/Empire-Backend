import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App, Games } from '@lib/fabzen-common/types';
import { RedisIoAdapter } from '@lib/fabzen-common/redis/adapter';

import { LudoMegaTournamentModule } from './ludo-mega-tournament.module';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.create(
    LudoMegaTournamentModule.forRoot(config.mongodb.mongoUri),
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: getServiceConfig(App.ludoMegaTournament),
  });
  app.enableCors();
  const { publicPort } = config.ludoMegaTournament;
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(Games.ludoMegaTournament);
  app.useWebSocketAdapter(redisIoAdapter);
  await app.startAllMicroservices();
  await app.listen(publicPort);
  logger.log(`Ludo Mega Tournament Service is running on Port ${publicPort}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
