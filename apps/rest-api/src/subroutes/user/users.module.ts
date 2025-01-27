import { DynamicModule, Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

@Module({})
export class UsersModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsersModule,
      imports: [MongooseModule.forRoot(mongoUri)],
      controllers: [UsersController],
    };
  }
}
