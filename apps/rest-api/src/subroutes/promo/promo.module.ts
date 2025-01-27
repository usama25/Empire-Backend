import { Module } from '@nestjs/common';

import { ReferralModule } from './referral/referral.module';
import { ReferralController } from './referral/referral.controller';
import { CouponModule } from './coupon/coupon.module';

@Module({
  imports: [ReferralModule, CouponModule],
  controllers: [ReferralController],
})
export class PromoModule {}
