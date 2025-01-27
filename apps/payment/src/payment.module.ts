import { APP_PIPE } from '@nestjs/core';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { PaymentControllersModule } from './infrastructure/controllers';

@Module({})
export class PaymentModule {
  static forRoot(mongoUri: string): DynamicModule {
    const clients = getServicesInfoToConnect(App.payment);
    return {
      module: PaymentModule,
      imports: [
        PaymentControllersModule.forRoot(mongoUri),
        EnvironmentModule,
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
