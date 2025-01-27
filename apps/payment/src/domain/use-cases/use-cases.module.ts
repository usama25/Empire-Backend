import { DynamicModule, Module } from '@nestjs/common';

import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { HttpClientModule } from '@lib/fabzen-common/http-client/src';

import { DepositUseCases, PayoutUseCases } from './';

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [
        HttpClientModule,
        MongooseModule.forRoot(mongoUri),
        RemoteConfigModule,
      ],
      providers: [DepositUseCases, PayoutUseCases],
      exports: [DepositUseCases, PayoutUseCases],
    };
  }
}
