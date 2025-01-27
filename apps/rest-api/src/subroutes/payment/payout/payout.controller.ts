import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiValidatedOkResponse,
  Authorize,
  UserID,
  Webhook,
} from '@lib/fabzen-common/decorators';
import { Role, TransporterProviders } from '@lib/fabzen-common/types';

import { PaymentProvider } from 'apps/payment/src/payment.providers';
import {
  ConvertToMainRequestDto,
  CreatePayoutOrderRequestDto,
  CreatePayoutOrderResponseDto,
  PayoutHistoryResponseDto,
  TdsDetailsResponse,
} from './payout.dto';
import { config } from '@lib/fabzen-common/configuration';
import { PaymentRepository } from 'apps/payment/src/domain/interfaces';
import { UserRoleGuard } from 'apps/rest-api/src/guards/user-role.guard';

@ApiBearerAuth()
@ApiTags('Payout')
@Controller()
export class PayoutController {
  private readonly paymentProvider: PaymentProvider;
  constructor(
    @Inject(TransporterProviders.PAYMENT_SERVICE)
    private paymentClient: ClientProxy,
    private paymentRepository: PaymentRepository,
  ) {
    this.paymentProvider = new PaymentProvider(this.paymentClient);
  }

  @Post('/create-order')
  @ApiOperation({ summary: 'Create Payout Order' })
  @ApiValidatedOkResponse(CreatePayoutOrderResponseDto)
  async createOrder(
    @Body() body: CreatePayoutOrderRequestDto,
    @UserID() userId: string,
  ): Promise<CreatePayoutOrderResponseDto> {
    return await this.paymentProvider.createPayoutOrder({
      userId,
      ...body,
    });
  }

  @Post('/convert-to-main')
  @ApiOperation({ summary: 'Create Payout Order' })
  @ApiValidatedOkResponse(CreatePayoutOrderResponseDto)
  async convertToMain(
    @Body() { amount }: ConvertToMainRequestDto,
    @UserID() userId: string,
  ): Promise<CreatePayoutOrderResponseDto> {
    return await this.paymentProvider.convertToMain({
      userId,
      amount,
    });
  }

  @Get('/history')
  @ApiOperation({ summary: 'Get user payout history' })
  @ApiValidatedOkResponse(PayoutHistoryResponseDto)
  async getDepositHistory(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.paymentProvider.getPayoutHistory({
      userId,
      skip,
      limit,
    });
  }

  @Webhook()
  @Post('/webhook/juspay')
  @ApiOperation({ summary: 'Juspay Payout Webhook' })
  async JuspayWebhook(@Body() body: any) {
    const { info } = body;
    const orderId = info?.merchantOrderId;
    return await this.paymentProvider.payoutWebhookJuspay({ orderId });
  }

  @Webhook()
  @Post('/webhook/cashfree')
  @ApiOperation({ summary: 'Cashfree Payout Webhook' })
  async CashfreeWebhook(@Body() body: any) {
    console.log('Cashfree Payout Webhook', body);
    const orderId = body.transferId;
    return await this.paymentProvider.payoutWebhookCashfree({ orderId });
  }

  @Get('/tax-details')
  @ApiOperation({ summary: 'Get user tax details' })
  @ApiValidatedOkResponse(TdsDetailsResponse)
  async getTaxDetails(@UserID() userId: string) {
    return await this.paymentRepository.getTaxDetails(userId);
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Get('/manual-review/approve')
  @ApiOperation({ summary: 'Manually Approve Withdrawal' })
  async manuallyApproveWithdrawal(@Query('orderId') orderId: string) {
    return await this.paymentProvider.manuallyApproveWithdrawal(orderId);
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Get('/manual-review/reject')
  @ApiOperation({ summary: 'Manually Reject Withdrawal' })
  async manuallyRejectWithdrawal(@Query('orderId') orderId: string) {
    return await this.paymentProvider.manuallyRejectWithdrawal(orderId);
  }

  @UseGuards(UserRoleGuard)
  @Authorize(Role.admin)
  @Get('/manual-review/verify')
  @ApiOperation({ summary: 'Manually Verify Withdrawal' })
  async manuallyVerifyWithdrawal(@Query('orderId') orderId: string) {
    return await this.paymentProvider.manuallyVerifyWithdrawal(orderId);
  }

  @Get('/verified-accounts')
  @ApiOperation({ summary: 'Withdrawal Verified Account' })
  async getVerifiedWithdrawalAccounts(@UserID() userId: string) {
    return await this.paymentProvider.getVerifiedWithdrawalAccounts(userId);
  }
}
