import { ClientsModule } from '@nestjs/microservices';
import { APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';
import { EPLGameControllersModule } from './infrastructure/controller/controllers.module';
import { UserModule } from 'apps/user/src/user.module';

@Module({})
export class EplGameplayModule {
  static forRoot(): DynamicModule {
    return {
      module: EplGameplayModule,
      imports: [
        EnvironmentModule,
        ClientsModule.register({
          clients: getServicesInfoToConnect(App.eplGameplay),
          isGlobal: true,
        }),
        EPLGameControllersModule.forRoot(),
        EventEmitterModule.forRoot(),
        UserModule,
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
