import { DynamicModule, Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

@Module({})
export class AdminModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: AdminModule,
      imports: [MongooseModule.forRoot(mongoUri)],
      controllers: [AdminController],
    };
  }
}
