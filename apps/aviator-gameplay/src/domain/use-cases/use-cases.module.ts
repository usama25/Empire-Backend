import { DynamicModule, Module } from '@nestjs/common';

import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

import { AviatorGameplayUseCases } from '.';
import { GatewayModule } from '../../infrastructure/gateways/';
import { RepositoryModule } from '../../infrastructure/repositories';

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [
        MongooseModule.forRoot(mongoUri),
        GatewayModule,
        RepositoryModule,
      ],
      providers: [AviatorGameplayUseCases],
      exports: [AviatorGameplayUseCases],
    };
  }
}
