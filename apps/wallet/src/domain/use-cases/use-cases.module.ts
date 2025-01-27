import { DynamicModule, Module } from '@nestjs/common';

import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';

import { WalletUseCases } from './wallet.use-cases';

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [MongooseModule.forRoot(mongoUri), RemoteConfigModule],
      providers: [WalletUseCases],
      exports: [WalletUseCases],
    };
  }
}
