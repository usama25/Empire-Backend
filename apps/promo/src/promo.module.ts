import { APP_PIPE } from '@nestjs/core';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';

import { PromoControllersModule } from './infrastructure/controllers/controllers.module';

@Module({})
export class PromoModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: PromoModule,
      imports: [EnvironmentModule, PromoControllersModule.forRoot(mongoUri)],
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
