import { Logger } from '@nestjs/common';
import {
  Environment,
  Gateway,
  JuspayApiStatusResponse,
  JuspayCreateDepositRequest,
  JuspayCreateOrderApiResponse,
  JuspayCreateOrderSdkPayload,
  JuspayCreatePayoutRequest,
  JuspayOrderStatus,
  JuspayPayoutCreateOrderResponse,
  JuspayPayoutStatus,
  JuspayPayoutStatusResponse,
  JuspaySessionResponse,
  PayoutType,
  TransferRequest,
  TxnStatus,
  PaymentMethod,
} from '@lib/fabzen-common/types';
import {
  CreateDepositOrder,
  NameMatchResult,
  PaymentGateway,
} from '../../domain/interfaces';
import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { CreateDepositOrderResponseDto } from '../controllers/dtos/deposit.transporter.dto';
import { config } from '@lib/fabzen-common/configuration';
import { PaymentEntity, UserEntity } from '@lib/fabzen-common/entities';
import { CreatePayoutOrderRequestDto } from '../controllers/dtos/payout.transporter.dto';

export class JuspayPaymentGateway extends PaymentGateway {
  private readonly logger = new Logger(JuspayPaymentGateway.name);
  constructor(private readonly httpClientService: HttpClientService) {
    super(Gateway.juspay);
  }

  async createDepositOrder(
    request: CreateDepositOrder,
  ): Promise<CreateDepositOrderResponseDto> {
    const { orderId } = request;
    const sdkPayload = await this.#createOrder(request);
    const paymentLink = await this.#generatePaymentLink(orderId);

    return {
      paymentLink,
      orderId,
      gateway: this.getGatewayName(),
      sdkPayload,
    };
  }

  async #createOrder(
    request: CreateDepositOrder,
  ): Promise<JuspayCreateOrderSdkPayload> {
    // Juspay Developer Documentation: [https://docs.juspay.in/hyper-checkout/android/base-sdk-integration/session]
    const requestData = this.#buildRequstData(request);
    const response: JuspayCreateOrderApiResponse =
      await this.#sendRequest(requestData);
    const { sdk_payload: sdkPayload } = response;
    return sdkPayload;
  }

  #buildRequstData(request: CreateDepositOrder): JuspayCreateDepositRequest {
    const {
      clientId,
      fallbackEmail,
      paymentPageDescription,
      urls: { returnUrl, webhookUrl },
    } = config.payment.juspay.deposit;
    const { orderId, amount, user } = request;
    const { username, email, mobileNumber } = user;

    return {
      order_id: orderId,
      amount,
      customer_id: username,
      customer_email: email ?? fallbackEmail,
      customer_phone: mobileNumber.number,
      payment_page_client_id: clientId,
      action: 'paymentPage',
      returnUrl: returnUrl,
      description: paymentPageDescription,
      'metadata.webhook_url': webhookUrl,
    };
  }

  getPayoutAccountHolderName(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async #sendRequest(
    requestData: JuspayCreateDepositRequest,
  ): Promise<JuspayCreateOrderApiResponse> {
    const {
      headers,
      urls: { sessionUrl },
    } = config.payment.juspay.deposit;
    return await this.httpClientService.post<JuspayCreateOrderApiResponse>(
      sessionUrl,
      requestData,
      { headers },
    );
  }

  async #generatePaymentLink(orderId: string): Promise<string> {
    const {
      merchantId,
      urls: { transactionApiUrl },
    } = config.payment.juspay.deposit;
    const requestData = `merchant_id=${merchantId}&order_id=${orderId}&payment_method_type=UPI&payment_method=UPI&txn_type=UPI_PAY&redirect_after_payment=true&format=json&sdk_params=true`;
    const response = await this.httpClientService.post<JuspaySessionResponse>(
      transactionApiUrl,
      requestData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      },
    );

    const { txn_id, payment } = response;
    const { mcc, amount, merchant_vpa, merchant_name } = payment.sdk_params;
    return encodeURI(
      `upi://pay?pa=${merchant_vpa}&pn=${merchant_name}&am=${amount}&mam=${amount}&cu=INR&tr=${txn_id}&tn=Payment for LudoEmpire&mc=${mcc}&mode=04&purpose=00&utm_campaign=B2B_PG&utm_source=${txn_id}`,
    );
  }

  async getDepositOrderStatus(
    orderId: string,
  ): Promise<{ updatedStatus: TxnStatus; paymentMethod: string }> {
    const { orderStatus, paymentMethod } =
      await this.#getStatusFromJuspay(orderId);
    const updatedStatus = this.#interpretOrderStatus(orderStatus);
    return { updatedStatus, paymentMethod };
  }

  async #getStatusFromJuspay(
    orderId: string,
  ): Promise<{ orderStatus: JuspayOrderStatus; paymentMethod: string }> {
    const {
      urls: { statusUrl },
      headers,
    } = config.payment.juspay.deposit;
    const orderStatusResponse =
      await this.httpClientService.get<JuspayApiStatusResponse>(
        `${statusUrl}/${orderId}`,
        { headers },
      );
    const { payment_method_type, status: orderStatus } = orderStatusResponse;
    const paymentMethod = payment_method_type ?? PaymentMethod.upi;
    return { orderStatus, paymentMethod };
  }

  #interpretOrderStatus(orderStatus: JuspayOrderStatus) {
    switch (orderStatus) {
      case JuspayOrderStatus.NEW:
      case JuspayOrderStatus.PENDING_VBV:
      case JuspayOrderStatus.COD_INITIATED:
      case JuspayOrderStatus.STARTED:
      case JuspayOrderStatus.PARTIAL_CHARGED:
      case JuspayOrderStatus.AUTHORIZING: {
        return TxnStatus.pending;
      }
      case JuspayOrderStatus.CHARGED: {
        return TxnStatus.success;
      }
    }

    return TxnStatus.failed;
  }

  async validatePayoutAccount(
    user: UserEntity,
    createPayoutOrderRequest: CreatePayoutOrderRequestDto,
  ): Promise<{
    accountHolderName: string;
    nameMatchResult: NameMatchResult;
  }> {
    this.logger.debug('No Validation in Juspay');
    this.logger.debug(user, createPayoutOrderRequest);
    return {
      accountHolderName: 'accountHolderName',
      nameMatchResult: NameMatchResult.MATCHED,
    };
  }

  async initiateTransfer(transferRequest: TransferRequest): Promise<TxnStatus> {
    // Juspay Developer Documentation: [https://docs.juspay.in/payout/docs/integration/order-create]
    const requestData: JuspayCreatePayoutRequest =
      this.#buildPayoutRequstData(transferRequest);
    await this.#sendPayoutRequest(requestData);
    const { orderId } = transferRequest;
    const orderStatus = await this.#getPayoutStatusFromJuspay(orderId);
    return this.#interpretPayoutStatus(orderStatus);
  }

  #buildPayoutRequstData(
    transferRequest: TransferRequest,
  ): JuspayCreatePayoutRequest {
    const { fallbackEmail } = config.payment.juspay.deposit;
    const {
      fallbackName,
      urls: { webhookUrl },
    } = config.payment.juspay.payout;
    const { amount, payoutType, upiId, account, orderId, user } =
      transferRequest;
    const { name, username, email, mobileNumber } = user;
    const type =
      payoutType === PayoutType.UPI
        ? PayoutType.UPI_ID
        : PayoutType.ACCOUNT_IFSC;

    const beneficiaryDetails = {
      type,
      details: {
        name: name ?? fallbackName,
        ...(type === PayoutType.UPI_ID
          ? { vpa: upiId }
          : { account: account?.accountNo, ifsc: account?.ifscCode }),
      },
    };

    let preferredMethodList;
    if (process.env.NODE_ENV === Environment.production) {
      preferredMethodList =
        type === PayoutType.UPI_ID ? ['CFGEN_UPI'] : ['CFGEN_IMPS'];
    } else {
      preferredMethodList = ['DUMMY_IMPS'];
    }

    return {
      orderId,
      fulfillments: [
        {
          preferredMethodList,
          amount: Number(amount),
          beneficiaryDetails,
          additionalInfo: {
            webhookDetails: {
              url: webhookUrl,
            },
          },
        },
      ],
      amount: Number(amount),
      customerId: username,
      customerPhone: mobileNumber.number,
      customerEmail: email ?? fallbackEmail,
      type: 'FULFILL_ONLY',
    };
  }

  async #sendPayoutRequest(
    requestData: JuspayCreatePayoutRequest,
  ): Promise<JuspayPayoutCreateOrderResponse> {
    const payoutRequest = JSON.stringify(requestData);
    const {
      headers,
      urls: { ordersUrl },
    } = config.payment.juspay.payout;
    return await this.httpClientService.post<JuspayPayoutCreateOrderResponse>(
      ordersUrl,
      payoutRequest,
      { headers },
    );
  }

  async getPayoutStatusFromGateway(order: PaymentEntity): Promise<TxnStatus> {
    const orderStatus = await this.#getPayoutStatusFromJuspay(order.orderId);
    return this.#interpretPayoutStatus(orderStatus);
  }

  async #getPayoutStatusFromJuspay(
    orderId?: string,
  ): Promise<JuspayPayoutStatus> {
    // Juspay Developer Documentation: [https://docs.juspay.in/payout/docs/integration/order-status]
    const {
      urls: { statusUrl },
      headers,
    } = config.payment.juspay.payout;
    const orderStatusResponse =
      await this.httpClientService.get<JuspayPayoutStatusResponse>(
        `${statusUrl}/${orderId}`,
        { headers },
      );
    return orderStatusResponse.status;
  }

  #interpretPayoutStatus(orderStatus: JuspayPayoutStatus) {
    switch (orderStatus) {
      case JuspayPayoutStatus.FULFILLMENTS_SCHEDULED:
      case JuspayPayoutStatus.READY_FOR_FULFILLMENT:
      case JuspayPayoutStatus.FULFILLMENTS_MANUAL_REVIEW: {
        return TxnStatus.pending;
      }
      case JuspayPayoutStatus.FULFILLMENTS_SUCCESSFUL: {
        return TxnStatus.success;
      }
    }

    return TxnStatus.refund;
  }

  async compareNames(name1: string, name2: string): Promise<NameMatchResult> {
    // TODO: implementation
    console.log(name1, name2);
    throw new Error('Method not implemented.');
  }
}
