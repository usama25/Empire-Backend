import { APP_PIPE } from '@nestjs/core';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';

import { NotificationControllersModule } from './infrastructure/controllers/controllers.module';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';
import { ClientsModule } from '@nestjs/microservices';

@Module({})
export class NotificationModule {
  static forRoot(mongoUri: string): DynamicModule {
    const clients = getServicesInfoToConnect(App.notification);
    return {
      module: NotificationModule,
      imports: [
        EnvironmentModule,
        NotificationControllersModule.forRoot(mongoUri),
        ClientsModule.register({
          clients,
          isGlobal: true,
        }),
      ],
      providers: [
        {
          provide: APP_PIPE,
          useValue: new ValidationPipe({
            whitelist: true,
          }),
        },
      ],
    };
  }
}
