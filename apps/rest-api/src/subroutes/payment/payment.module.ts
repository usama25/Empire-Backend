import { Module } from '@nestjs/common';

import { DepositModule } from './deposit/deposit.module';
import { PaymentController } from './payment.controller';

@Module({
  imports: [DepositModule, PaymentModule],
  controllers: [PaymentController],
})
export class PaymentModule {}
