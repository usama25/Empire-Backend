import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ClientsModule } from '@nestjs/microservices';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { App } from '@lib/fabzen-common/types';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';

import { AuthControllersModule } from './infrastructure/controllers';

@Module({})
export class AuthModule {
  static forRoot(mongoUri: string): DynamicModule {
    const clients = getServicesInfoToConnect(App.auth);
    return {
      module: AuthModule,
      imports: [
        AuthControllersModule.forRoot(mongoUri),
        EnvironmentModule,
        RemoteConfigModule,
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
