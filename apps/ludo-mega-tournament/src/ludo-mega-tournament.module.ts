import { APP_PIPE } from '@nestjs/core';
import { ClientsModule } from '@nestjs/microservices';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';
import { LudoMegaTournamentControllersModule } from './infrastructure/controllers/controllers.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({})
export class LudoMegaTournamentModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: LudoMegaTournamentModule,
      imports: [
        EnvironmentModule,
        ClientsModule.register({
          clients: getServicesInfoToConnect(App.ludoMegaTournament),
          isGlobal: true,
        }),
        LudoMegaTournamentControllersModule.forRoot(mongoUri),
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
