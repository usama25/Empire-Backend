import { DynamicModule, Module } from '@nestjs/common';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { PromoUseCases } from './promo.use-cases';

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [MongooseModule.forRoot(mongoUri), RemoteConfigModule],
      providers: [PromoUseCases],
      exports: [PromoUseCases],
    };
  }
}
