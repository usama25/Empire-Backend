import { DynamicModule, Module } from '@nestjs/common';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

import { SecurityUseCases, OtpUseCases } from './';
import { GatewaysModule } from '../../infrastructure/gateways';
import { RepositoriesModule } from '../../infrastructure/repositories';

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [
        GatewaysModule,
        MongooseModule.forRoot(mongoUri),
        RemoteConfigModule,
        RepositoriesModule,
      ],
      providers: [SecurityUseCases, OtpUseCases],
      exports: [SecurityUseCases, OtpUseCases],
    };
  }
}
