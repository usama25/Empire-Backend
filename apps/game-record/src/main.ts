import { NestFactory } from '@nestjs/core';
import { GameRecordModule } from './game-record.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { config, getServiceConfig } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';
import { Logger } from '@nestjs/common';

const logger = new Logger('main');

async function bootstrap() {
  const { mongoUri } = config.mongodb;
  const { host, port } = getServiceConfig(App.gameRecord);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    GameRecordModule.forRoot(mongoUri),
    {
      transport: Transport.TCP,
      options: {
        host,
        port,
      },
    },
  );
  await app.listen();
  logger.log(`Game Record Service is running on Port ${port}`);
}
// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
