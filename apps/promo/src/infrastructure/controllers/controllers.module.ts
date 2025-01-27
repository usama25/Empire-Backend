import { DynamicModule, Module } from '@nestjs/common';

import { UsecasesModule } from '../../domain/use-cases';
import { PromoTransporterController } from './transporter.controller';

@Module({})
export class PromoControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: PromoControllersModule,
      imports: [UsecasesModule.forRoot(mongoUri)],
      controllers: [PromoTransporterController],
    };
  }
}
