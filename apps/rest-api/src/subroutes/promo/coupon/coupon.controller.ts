import { ClientProxy } from '@nestjs/microservices';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { TransporterProviders } from '@lib/fabzen-common/types';
import { CreateCouponDto } from './coupon.dto';
import { PromoProvider } from 'apps/promo/src/promo.provider';

@ApiBearerAuth()
@ApiTags('Coupon')
@Controller()
export class CouponController {
  private readonly promoProvider: PromoProvider;
  constructor(
    @Inject(TransporterProviders.PROMO_SERVICE)
    private promoClient: ClientProxy,
  ) {
    this.promoProvider = new PromoProvider(this.promoClient);
  }

  @Get('/:promoCode')
  @ApiOperation({ summary: 'Get Coupon by Promo Code' })
  async getCouponByPromoCode(@Param('promoCode') promoCode: string) {
    return await this.promoProvider.getCouponByPromoCode(promoCode);
  }

  @Post('/')
  @ApiOperation({ summary: 'Create New Coupon' })
  async createCoupon(@Body() body: CreateCouponDto) {
    return await this.promoProvider.createCoupon(body);
  }

  @Delete('/:promoCode')
  @ApiOperation({ summary: 'Delete Coupon' })
  async deleteCoupon(@Param('promoCode') promoCode: string) {
    return await this.promoProvider.deleteCoupon(promoCode);
  }
}
