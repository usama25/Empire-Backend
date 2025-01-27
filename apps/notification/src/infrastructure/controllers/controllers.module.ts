import { DynamicModule, Module } from '@nestjs/common';

import { NotificationTrasporterController } from './';
import { UsecasesModule } from '../../domain/use-cases';

@Module({})
export class NotificationControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: NotificationControllersModule,
      imports: [UsecasesModule.forRoot(mongoUri)],
      controllers: [NotificationTrasporterController],
    };
  }
}
