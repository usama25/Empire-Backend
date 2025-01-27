import { APP_PIPE } from '@nestjs/core';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';

import { App } from '@lib/fabzen-common/types';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';

import { UserControllersModule } from './infrastructure/controllers/controllers.module';

@Module({})
export class UserModule {
  static forRoot(mongoUri: string): DynamicModule {
    const clients = getServicesInfoToConnect(App.user);
    return {
      module: UserModule,
      imports: [
        EnvironmentModule,
        UserControllersModule.forRoot(mongoUri),
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
