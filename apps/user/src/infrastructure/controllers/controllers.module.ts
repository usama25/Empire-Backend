import { DynamicModule, Module } from '@nestjs/common';

import { UsecasesModule } from '../../domain/user-cases';
import { UserTransporterController } from './transporter.controller';

@Module({})
export class UserControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UserControllersModule,
      imports: [UsecasesModule.forRoot(mongoUri)],
      controllers: [UserTransporterController],
    };
  }
}
