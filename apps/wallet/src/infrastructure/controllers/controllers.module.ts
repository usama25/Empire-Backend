import { DynamicModule, Module } from '@nestjs/common';

import { WalletTransporterController } from './transporter.controller';
import { UsecasesModule } from '../../domain/use-cases/use-cases.module';

@Module({})
export class WalletControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: WalletControllersModule,
      imports: [UsecasesModule.forRoot(mongoUri)],
      controllers: [WalletTransporterController],
    };
  }
}
