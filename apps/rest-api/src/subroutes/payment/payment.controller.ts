import { ClientProxy } from '@nestjs/microservices';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { TransporterProviders } from '@lib/fabzen-common/types';
import { ApiValidatedOkResponse, UserID } from '@lib/fabzen-common/decorators';
import { PaymentProvider } from 'apps/payment/src/payment.providers';
import {
  ConversionRateResponseDto,
  GenerateInvoiceRequest,
} from './deposit/deposit.dto';

@ApiBearerAuth()
@ApiTags('Payment')
@Controller()
export class PaymentController {
  private readonly paymentProvider: PaymentProvider;
  constructor(
    @Inject(TransporterProviders.PAYMENT_SERVICE)
    private paymentClient: ClientProxy,
  ) {
    this.paymentProvider = new PaymentProvider(this.paymentClient);
  }

  @Get('/conversion-rate')
  @ApiOperation({ summary: 'Get Conversion rate for the user' })
  @ApiValidatedOkResponse(ConversionRateResponseDto)
  async getConversionRate(
    @UserID() userId: string,
  ): Promise<ConversionRateResponseDto> {
    return await this.paymentProvider.getConversionRate(userId);
  }

  @Post('/generate-invoice')
  @ApiOperation({ summary: 'Generate Invoice for orderId' })
  async generateInvoice(@Body() body: GenerateInvoiceRequest): Promise<string> {
    return await this.paymentProvider.generateInvoice(body);
  }
}
