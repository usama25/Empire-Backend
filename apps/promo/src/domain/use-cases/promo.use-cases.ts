import { CouponDto } from '@lib/fabzen-common/types';
import { Injectable } from '@nestjs/common';
import { PromoRepository } from '../interfaces';

@Injectable()
export class PromoUseCases {
  constructor(private promoRepository: PromoRepository) {}
  async createCoupon(newCoupon: CouponDto) {
    await this.promoRepository.createCoupon(newCoupon);
  }

  async deleteCoupon(promoCode: string) {
    await this.promoRepository.deleteCoupon(promoCode);
  }

  async getCouponByPromoCode(promoCode: string): Promise<CouponDto> {
    return await this.promoRepository.getCouponByPromoCode(promoCode);
  }
}
