import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types/microservices.types';

import {
  CreateDepositOrderRequestDto,
  CreateDepositOrderResponseDto,
  GetOrderStatusRequestDto,
  GetOrderStatusResponseDto,
} from './infrastructure/controllers/dtos/deposit.transporter.dto';
import {
  ConvertToMainRequestDto,
  CreatePayoutOrderRequestDto,
  CreatePayoutOrderResponseDto,
} from './infrastructure/controllers/dtos/payout.transporter.dto';
import { HistoryParameters, WebhookRequest } from '@lib/fabzen-common/types';
import {
  ConversionRateResponseDto,
  GenerateInvoiceRequest,
} from 'apps/rest-api/src/subroutes/payment/deposit/deposit.dto';
import { VerifiedWithdrawalAccountDto } from 'apps/rest-api/src/subroutes/payment/payout/payout.dto';

export class PaymentProvider extends MicroserviceProvider {
  async createDepositOrder(
    createDepositOrderRequest: CreateDepositOrderRequestDto,
  ) {
    return await this._sendRequest<CreateDepositOrderResponseDto>(
      TransporterCmds.CREATE_DEPOSIT_ORDER,
      createDepositOrderRequest,
    );
  }

  async getDepositOrderStatus(parameters: GetOrderStatusRequestDto) {
    return this._sendRequest<GetOrderStatusResponseDto>(
      TransporterCmds.DEPOSIT_CASHFREE_STATUS,
      parameters,
    );
  }

  async createPayoutOrder(
    createPayoutOrderRequest: CreatePayoutOrderRequestDto,
  ) {
    return await this._sendRequest<CreatePayoutOrderResponseDto>(
      TransporterCmds.CREATE_PAYOUT_ORDER,
      createPayoutOrderRequest,
    );
  }

  async convertToMain(
    convertToMainRequestDto: ConvertToMainRequestDto,
  ): Promise<CreatePayoutOrderResponseDto> {
    return await this._sendRequest<CreatePayoutOrderResponseDto>(
      TransporterCmds.CONVERT_TO_MAIN,
      convertToMainRequestDto,
    );
  }

  async getDepositHistory(historyParameters: HistoryParameters) {
    return await this._sendRequest(
      TransporterCmds.GET_DEPOSIT_HISTORY,
      historyParameters,
    );
  }

  async getPayoutHistory(historyParameters: HistoryParameters) {
    return await this._sendRequest(
      TransporterCmds.GET_PAYOUT_HISTORY,
      historyParameters,
    );
  }

  async depositWebhook(parameters: WebhookRequest) {
    return await this._sendRequest(TransporterCmds.DEPOSIT_WEBHOOK, parameters);
  }

  async payoutWebhookJuspay(parameters: WebhookRequest) {
    return await this._sendRequest(
      TransporterCmds.JUSPAY_PAYOUT_WEBHOOK,
      parameters,
    );
  }

  async payoutWebhookCashfree(parameters: WebhookRequest) {
    return await this._sendRequest(
      TransporterCmds.CASHFREE_PAYOUT_WEBHOOK,
      parameters,
    );
  }

  async getConversionRate(userId: string): Promise<ConversionRateResponseDto> {
    return await this._sendRequest(TransporterCmds.GET_CONVERSION_RATE, {
      userId,
    });
  }

  async generateInvoice(body: GenerateInvoiceRequest): Promise<string> {
    return await this._sendRequest(TransporterCmds.GENERATE_INVOICE, {
      orderId: body.orderId,
      overwrite: body.overwrite,
    });
  }

  async manuallyApproveWithdrawal(orderId: string): Promise<void> {
    return await this._sendRequest(
      TransporterCmds.MANUALLY_APPROVE_WITHDRAWAL,
      {
        orderId,
      },
    );
  }

  async manuallyRejectWithdrawal(orderId: string): Promise<void> {
    return await this._sendRequest(TransporterCmds.MANUALLY_REJECT_WITHDRAWAL, {
      orderId,
    });
  }

  async manuallyVerifyWithdrawal(orderId: string): Promise<void> {
    return await this._sendRequest(TransporterCmds.MANUALLY_VERIFY_WITHDRAWAL, {
      orderId,
    });
  }

  async getVerifiedWithdrawalAccounts(
    userId: string,
  ): Promise<VerifiedWithdrawalAccountDto> {
    return await this._sendRequest(
      TransporterCmds.WITHDRAWALS_VERIFIED_ACCOUNTS,
      {
        userId,
      },
    );
  }
}
