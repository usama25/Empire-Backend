import { DynamicModule, Module } from '@nestjs/common';

import { PaymentTransporterController } from './';
import { UsecasesModule } from '../../domain/use-cases';

@Module({})
export class PaymentControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: PaymentControllersModule,
      imports: [UsecasesModule.forRoot(mongoUri)],
      controllers: [PaymentTransporterController],
    };
  }
}
