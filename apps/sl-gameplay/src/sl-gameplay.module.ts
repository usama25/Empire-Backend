import { ClientsModule } from '@nestjs/microservices';
import { APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { SLGameControllersModule } from './infrastructure/controller/controllers.module';

@Module({})
export class SlGameplayModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: SlGameplayModule,
      imports: [
        EnvironmentModule,
        ClientsModule.register({
          clients: getServicesInfoToConnect(App.slGameplay),
          isGlobal: true,
        }),
        SLGameControllersModule.forRoot(mongoUri),
        EventEmitterModule.forRoot(),
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
