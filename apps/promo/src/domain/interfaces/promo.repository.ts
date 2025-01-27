import { CouponDto } from '@lib/fabzen-common/types';

export abstract class PromoRepository {
  abstract getReferralHistory(): Promise<void>;
  abstract createCoupon(newCoupon: CouponDto): Promise<void>;
  abstract deleteCoupon(promoCode: string): Promise<void>;
  abstract getCouponByPromoCode(promoCode: string): Promise<CouponDto>;
}

export const createMockPromoRepository = (): PromoRepository => ({
  getReferralHistory: jest.fn(),
  createCoupon: jest.fn(),
  deleteCoupon: jest.fn(),
  getCouponByPromoCode: jest.fn(),
});
