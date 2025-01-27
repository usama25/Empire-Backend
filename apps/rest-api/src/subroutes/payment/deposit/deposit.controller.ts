import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiValidatedOkResponse,
  UserID,
  Webhook,
} from '@lib/fabzen-common/decorators';
import { TransporterProviders } from '@lib/fabzen-common/types/microservices.types';

import { PaymentProvider } from 'apps/payment/src/payment.providers';
import {
  CreateDepositOrderRequestDto,
  CreateDepositOrderResponseDto,
  DepositHistoryResponseDto,
  GetOrderStatusRequestDto,
  GetOrderStatusResponseDto,
} from './deposit.dto';
import { config } from '@lib/fabzen-common/configuration';

@ApiBearerAuth()
@ApiTags('Deposit')
@Controller()
export class DepositController {
  private readonly paymentProvider: PaymentProvider;
  constructor(
    @Inject(TransporterProviders.PAYMENT_SERVICE)
    private paymentClient: ClientProxy,
  ) {
    this.paymentProvider = new PaymentProvider(this.paymentClient);
  }

  @Post('/create-order')
  @ApiOperation({ summary: 'Create Deposit Order' })
  @ApiValidatedOkResponse(CreateDepositOrderResponseDto)
  async createOrder(
    @Body() body: CreateDepositOrderRequestDto,
    @UserID() userId: string,
  ): Promise<CreateDepositOrderResponseDto> {
    return await this.paymentProvider.createDepositOrder({
      userId,
      ...body,
    });
  }

  @Get('/order-status/:orderId')
  @ApiOperation({ summary: 'Get Deposit Order Status' })
  @ApiValidatedOkResponse(GetOrderStatusResponseDto)
  async getOrderStatus(
    @Param() { orderId }: GetOrderStatusRequestDto,
    @UserID() userId: string,
  ): Promise<GetOrderStatusResponseDto> {
    return await this.paymentProvider.getDepositOrderStatus({
      orderId,
      userId,
    });
  }

  @Get('/history')
  @ApiOperation({ summary: 'Get user deposit history' })
  @ApiValidatedOkResponse(DepositHistoryResponseDto)
  async getDepositHistory(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.paymentProvider.getDepositHistory({
      userId,
      skip,
      limit,
    });
  }

  @Webhook()
  @Post('/webhook/juspay')
  @ApiOperation({ summary: 'Juspay Deposit Webhook' })
  async juspayWebhook(@Body() body: any) {
    const orderId = body.content?.order?.order_id;
    return await this.paymentProvider.depositWebhook({ orderId });
  }

  @Webhook()
  @Post('/webhook/cashfree')
  @ApiOperation({ summary: 'Cashfree Deposit Webhook' })
  async cashfreeWebhook(@Body() body: any) {
    const { orderId } = body;
    if (orderId) {
      return await this.paymentProvider.depositWebhook({ orderId });
    }
  }
}
