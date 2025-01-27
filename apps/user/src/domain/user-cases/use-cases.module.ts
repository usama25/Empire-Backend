import { DynamicModule, Module } from '@nestjs/common';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { UserUseCases } from './user.use-cases';
import { GatewaysModule } from '../../infrastructure/gateways';
import { RepositoriesModule } from '../../infrastructure/repositories/repositories.module';

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [
        MongooseModule.forRoot(mongoUri),
        GatewaysModule,
        RemoteConfigModule,
        RepositoriesModule,
      ],
      providers: [UserUseCases],
      exports: [UserUseCases],
    };
  }
}
