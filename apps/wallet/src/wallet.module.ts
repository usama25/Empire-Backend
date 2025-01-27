import { APP_PIPE } from '@nestjs/core';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';

import { WalletControllersModule } from './infrastructure/controllers/controllers.module';

@Module({})
export class WalletModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: WalletModule,
      imports: [EnvironmentModule, WalletControllersModule.forRoot(mongoUri)],
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
