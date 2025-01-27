import { DynamicModule, Module } from '@nestjs/common';

import { PayoutController } from './payout.controller';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

@Module({})
export class PayoutModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: PayoutModule,
      imports: [MongooseModule.forRoot(mongoUri)],
      controllers: [PayoutController],
    };
  }
}
