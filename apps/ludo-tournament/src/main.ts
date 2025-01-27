import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { getServiceConfig } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { LudoTournamentModule } from './ludo-tournament.module';

const logger = new Logger('main');

async function bootstrap() {
  const { host, port } = getServiceConfig(App.ludoTournament);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    LudoTournamentModule,
    {
      transport: Transport.TCP,
      options: { host, port },
    },
  );
  await app.listen();
  logger.log(`Ludo Tournament Service is running on Port ${port}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
