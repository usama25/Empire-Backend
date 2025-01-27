import { Controller, UseInterceptors } from '@nestjs/common';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { PromoUseCases } from '../../domain/use-cases';
import { CouponDto, TransporterCmds } from '@lib/fabzen-common/types';
import { MessagePattern } from '@nestjs/microservices';
import { MessageData } from '@lib/fabzen-common/decorators';
import {
  CreateCouponDto,
  GetCouponByPromoCodeDto,
} from 'apps/rest-api/src/subroutes/promo/coupon/coupon.dto';
@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class PromoTransporterController {
  constructor(private readonly promoUseCases: PromoUseCases) {}

  @MessagePattern(TransporterCmds.GET_COUPON_BY_PROMO_CODE)
  async getCouponByPromoCode(
    @MessageData(GetCouponByPromoCodeDto)
    { promoCode }: GetCouponByPromoCodeDto,
  ): Promise<CouponDto> {
    return await this.promoUseCases.getCouponByPromoCode(promoCode);
  }

  @MessagePattern(TransporterCmds.CREATE_COUPON)
  async createCoupon(
    @MessageData(CreateCouponDto)
    createDepositOrderRequest: CreateCouponDto,
  ) {
    await this.promoUseCases.createCoupon(createDepositOrderRequest);
  }

  @MessagePattern(TransporterCmds.DELETE_COUPON)
  async deleteCoupon(
    @MessageData(GetCouponByPromoCodeDto)
    { promoCode }: GetCouponByPromoCodeDto,
  ) {
    return await this.promoUseCases.deleteCoupon(promoCode);
  }
}
