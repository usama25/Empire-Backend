import { Model } from 'mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PromoRepository } from 'apps/promo/src/domain/interfaces';
import { Coupon, CouponDocument } from '../models';
import { CouponDto } from '@lib/fabzen-common/types';

@Injectable()
export class MongoosePromoRepository implements PromoRepository {
  constructor(
    @InjectModel(Coupon.name)
    public couponModel: Model<CouponDocument>,
  ) {}

  async getReferralHistory(): Promise<void> {}

  async createCoupon(newCoupon: CouponDto): Promise<void> {
    const newCouponDocument = new this.couponModel({
      ...newCoupon,
    });
    await newCouponDocument.save();
  }

  async deleteCoupon(promoCode: string): Promise<void> {
    await this.couponModel.deleteOne({
      promoCode,
    });
  }

  async getCouponByPromoCode(promoCode: string): Promise<CouponDto> {
    const coupon = await this.couponModel.findOne(
      {
        promoCode,
      },
      { _id: 0, __v: 0 },
    );
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }
}
