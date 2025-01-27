import * as basicAuth from 'express-basic-auth';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { config } from '@lib/fabzen-common/configuration';

import { RestApiModule } from './rest-api.module';
import { AllExceptionsFilter } from '@lib/fabzen-common/exception-filters/all-exception.filter';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.create(
    RestApiModule.forRoot(config.mongodb.mongoUri),
  );

  // Enable Swagger Documentation on Staging/Local Env
  if (config.isDevelopment) {
    const { username, password } = config.auth.swagger;
    // Basic Auth
    app.use(
      '/api-docs*',
      basicAuth({
        challenge: true,
        users: {
          [username]: password,
        },
      }),
    );
    const documentBuilder = new DocumentBuilder()
      .setTitle('Fabzen REST API')
      .setDescription('Fabzen REST API Documentation')
      .setVersion('1.0')
      .addTag('Fabzen')
      .addBearerAuth()
      .addGlobalParameters({
        description: 'Maintenance Bypass Key',
        name: 'key',
        in: 'query',
      })
      .build();
    const document = SwaggerModule.createDocument(app, documentBuilder);
    SwaggerModule.setup('/api-docs', app, document);
  }
  app.enableCors();
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  await app.listen(config.restApi.port);
  logger.log(`Fabzen REST API Service is running on: ${await app.getUrl()}`);
}
// eslint-disable-next-line unicorn/prefer-top-level-await
bootstrap();
