import { TransporterCmds } from '@lib/fabzen-common/types';
import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import {
  CreateCouponDto,
  GetCouponDto,
} from 'apps/rest-api/src/subroutes/promo/coupon/coupon.dto';

export class PromoProvider extends MicroserviceProvider {
  async getReferralHistory(userId: string): Promise<void> {
    return this._sendRequest<void>(TransporterCmds.REFERRAL_HISTORY, {
      userId,
    });
  }

  async getCouponByPromoCode(promoCode: string): Promise<GetCouponDto> {
    return this._sendRequest<GetCouponDto>(
      TransporterCmds.GET_COUPON_BY_PROMO_CODE,
      {
        promoCode,
      },
    );
  }

  async createCoupon(newCoupon: CreateCouponDto) {
    return await this._sendRequest(TransporterCmds.CREATE_COUPON, {
      ...newCoupon,
    });
  }

  async deleteCoupon(promoCode: string) {
    return this._sendRequest(TransporterCmds.DELETE_COUPON, {
      promoCode,
    });
  }
}
