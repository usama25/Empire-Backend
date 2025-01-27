import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { MessageData } from '@lib/fabzen-common/decorators';
import {
  HistoryParameters,
  TransporterCmds,
  WebhookRequest,
} from '@lib/fabzen-common/types';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';

import {
  CreateDepositOrderRequestDto,
  CreateDepositOrderResponseDto,
  GetOrderStatusRequestDto,
  GetOrderStatusResponseDto,
} from './dtos/deposit.transporter.dto';
import {
  ConvertToMainRequestDto,
  CreatePayoutOrderRequestDto,
  CreatePayoutOrderResponseDto,
} from './dtos/payout.transporter.dto';
import { PayoutUseCases, DepositUseCases } from '../../domain/use-cases';
import { DepositHistoryResponseDto } from 'apps/rest-api/src/subroutes/payment/deposit/deposit.dto';
import { PayoutHistoryResponseDto } from 'apps/rest-api/src/subroutes/payment/payout/payout.dto';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class PaymentTransporterController {
  constructor(
    private readonly depositUseCases: DepositUseCases,
    private readonly payoutUseCases: PayoutUseCases,
  ) {}

  @MessagePattern(TransporterCmds.CREATE_DEPOSIT_ORDER)
  async createDepositOrder(
    @MessageData(CreateDepositOrderRequestDto)
    createDepositOrderRequest: CreateDepositOrderRequestDto,
  ): Promise<CreateDepositOrderResponseDto> {
    return await this.depositUseCases.createDepositOrder(
      createDepositOrderRequest,
    );
  }

  @MessagePattern(TransporterCmds.DEPOSIT_CASHFREE_STATUS)
  async GetDepositOrderStatus(
    @MessageData(GetOrderStatusRequestDto)
    getOrderStatusRequest: GetOrderStatusRequestDto,
  ): Promise<GetOrderStatusResponseDto> {
    const { orderId } = getOrderStatusRequest;
    const { status, amount } =
      await this.depositUseCases.getDepositOrderStatus(orderId);
    return { status, amount };
  }

  @MessagePattern(TransporterCmds.CREATE_PAYOUT_ORDER)
  async createPayoutOrder(
    @MessageData(CreatePayoutOrderRequestDto)
    createPayoutOrderRequest: CreatePayoutOrderRequestDto,
  ): Promise<CreatePayoutOrderResponseDto> {
    return await this.payoutUseCases.createPayoutOrder(
      createPayoutOrderRequest,
    );
  }

  @MessagePattern(TransporterCmds.CONVERT_TO_MAIN)
  async convertToMain(
    @MessageData(ConvertToMainRequestDto)
    { userId, amount }: ConvertToMainRequestDto,
  ) {
    return await this.payoutUseCases.convertToMain(userId, amount);
  }

  @MessagePattern(TransporterCmds.GET_DEPOSIT_HISTORY)
  async getDepositHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<DepositHistoryResponseDto> {
    return await this.depositUseCases.getHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_PAYOUT_HISTORY)
  async getPayoutHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<PayoutHistoryResponseDto> {
    return await this.payoutUseCases.getHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.DEPOSIT_WEBHOOK)
  async depositWebhook(@MessageData() depositWebhook: WebhookRequest) {
    const { orderId } = depositWebhook;
    await this.depositUseCases.getDepositOrderStatus(orderId);
  }

  @MessagePattern(TransporterCmds.JUSPAY_PAYOUT_WEBHOOK)
  async juspayPayoutWebhook(@MessageData() payoutWebhook: WebhookRequest) {
    const { orderId } = payoutWebhook;
    await this.payoutUseCases.webhookJuspay(orderId);
  }

  @MessagePattern(TransporterCmds.CASHFREE_PAYOUT_WEBHOOK)
  async cashfreePayoutWebhook(@MessageData() payoutWebhook: WebhookRequest) {
    const { orderId } = payoutWebhook;
    await this.payoutUseCases.webhookCashfree(orderId);
  }

  @MessagePattern(TransporterCmds.GET_CONVERSION_RATE)
  async getConversionRate(@MessageData() { userId }: { userId: string }) {
    return await this.depositUseCases.getConversionRate(userId);
  }

  @MessagePattern(TransporterCmds.GENERATE_INVOICE)
  async generateInvoice(
    @MessageData()
    { orderId, overwrite }: { orderId: string; overwrite: boolean },
  ) {
    return await this.depositUseCases.generateInvoice(orderId, overwrite);
  }

  @MessagePattern(TransporterCmds.MANUALLY_APPROVE_WITHDRAWAL)
  async manuallyApproveWithdrawal(
    @MessageData()
    { orderId }: { orderId: string },
  ) {
    return await this.payoutUseCases.manuallyApproveWithdrawal(orderId);
  }

  @MessagePattern(TransporterCmds.MANUALLY_REJECT_WITHDRAWAL)
  async manuallyRejectWithdrawal(
    @MessageData()
    { orderId }: { orderId: string },
  ) {
    return await this.payoutUseCases.manuallyRejectWithdrawal(orderId);
  }

  @MessagePattern(TransporterCmds.MANUALLY_VERIFY_WITHDRAWAL)
  async manuallyVerifyWithdrawal(
    @MessageData()
    { orderId }: { orderId: string },
  ) {
    return await this.payoutUseCases.manuallyVerifyWithdrawal(orderId);
  }

  @MessagePattern(TransporterCmds.WITHDRAWALS_VERIFIED_ACCOUNTS)
  async getVerifiedWithdrawalAccounts(
    @MessageData() { userId }: { userId: string },
  ) {
    return await this.payoutUseCases.getVerifiedWithdrawalAccounts(userId);
  }
}
