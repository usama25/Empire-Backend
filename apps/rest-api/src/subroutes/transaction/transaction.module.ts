import { DynamicModule, Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

@Module({})
export class TransactionModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: TransactionModule,
      imports: [MongooseModule.forRoot(mongoUri)],
      controllers: [TransactionController],
    };
  }
}
