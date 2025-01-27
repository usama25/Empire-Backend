import { APP_PIPE } from '@nestjs/core';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

@Module({})
export class SchedulerModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: SchedulerModule,
      imports: [
        EnvironmentModule,
        ClientsModule.register({
          clients: getServicesInfoToConnect(App.scheduler),
          isGlobal: true,
        }),
        ScheduleModule.forRoot(),
        MongooseModule.forRoot(mongoUri),
      ],
      controllers: [SchedulerController],
      providers: [
        SchedulerService,
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
