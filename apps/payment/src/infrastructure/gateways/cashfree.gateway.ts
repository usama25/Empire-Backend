// @ts-expect-error :  Temporary suppression because cashfree-sdk lacks TypeScript definitions.
import * as Cashfree from 'cashfree-sdk';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import {
  CashfreeOrderStatusApiResponse,
  CashfreeCreateOrderApiResponse,
  CashfreeOrderStatus,
  TxnStatus,
  CashfreeSessionResponse,
  CashfreeCreateDepositRequest,
  Gateway,
  PayoutType,
  beneficiaryRequest,
  ValidateIMPS,
  TransferRequest,
  Currency,
  PaymentMethod,
  CashfreePaymentDetails,
  CashfreePaymentStatus,
  CashfreePaymentMethod,
  Account,
} from '@lib/fabzen-common/types/payment.types';
import { config } from '@lib/fabzen-common/configuration';
import { HttpClientService } from '@lib/fabzen-common/http-client/src';

import { CreateDepositOrderResponseDto } from '../controllers/dtos/deposit.transporter.dto';
import {
  CreateDepositOrder,
  NameMatchResult,
  PaymentGateway,
} from '../../domain/interfaces';
import { PaymentEntity, UserEntity } from '@lib/fabzen-common/entities';
import { CreatePayoutOrderRequestDto } from '../controllers/dtos/payout.transporter.dto';
import { Address } from '@lib/fabzen-common/types';

type CashfreeApiResponse<T> = {
  status: 'SUCCESS' | 'ERROR';
  subCode: string;
  message: string;
  accountStatus?: 'VALID' | 'INVALID';
  data: T;
};

type CashfreeAccountValidationResult = {
  status: 'SUCCESS' | 'ERROR';
  subCode: string;
  accountStatus?: 'VALID' | 'INVALID';
  data: {
    nameAtBank: string;
    accountExists: 'YES' | 'NO';
    nameMatchScore: string;
    nameMatchResult: string;
  };
};

export class CashfreePaymentGateway extends PaymentGateway {
  private readonly logger = new Logger(CashfreePaymentGateway.name);
  constructor(private readonly httpClientService: HttpClientService) {
    super(Gateway.cashfree);
    Cashfree.Payouts.Init({
      ENV: config.payment.cashfree.payout.env,
      ClientID: config.payment.cashfree.payout.clientId,
      ClientSecret: config.payment.cashfree.payout.clientSecret,
    });
  }

  async createDepositOrder(
    request: CreateDepositOrder,
  ): Promise<CreateDepositOrderResponseDto> {
    const paymentSessionId = await this.#createOrder(request);
    const paymentLink = await this.#generatePaymentLink(paymentSessionId);
    const { orderId, paymentMethod } = request;
    return {
      paymentLink,
      orderId,
      gateway: this.getGatewayName(),
      paymentSessionId,
      paymentMethod,
    };
  }

  async getDepositOrderStatus(
    orderId: string,
  ): Promise<{ updatedStatus: TxnStatus; paymentMethod: string }> {
    const orderStatus = await this.#getStatusFromCashfree(orderId);
    const updatedStatus = this.#interpretOrderStatus(orderStatus);
    this.logger.log(
      `Cashfree Deposit Status ${orderId}: ${orderStatus} => ${updatedStatus}`,
    );
    let paymentMethod = PaymentMethod.upi;
    if (updatedStatus === TxnStatus.success) {
      paymentMethod = await this.#getPaymentMethodFromCashfree(orderId);
    }
    return { updatedStatus, paymentMethod };
  }

  async #createOrder(request: CreateDepositOrder): Promise<string> {
    // Cashfree Developer Documentation: [https://docs.cashfree.com/reference/pgcreateorder]
    const requestData = this.#buildRequstData(request);
    const response: CashfreeCreateOrderApiResponse =
      await this.#sendRequest(requestData);
    const { payment_session_id: paymentSessionId } = response;
    return paymentSessionId;
  }

  #buildRequstData(request: CreateDepositOrder): CashfreeCreateDepositRequest {
    const {
      orderNote,
      fallbackName,
      urls: { returnUrl, notifyUrl },
    } = config.payment.cashfree.deposit;
    const { orderId, amount, user } = request;
    const { name, username, email, mobileNumber } = user;

    return {
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: Currency.INR,
      order_note: orderNote,
      customer_details: {
        customer_id: username,
        customer_name: name ?? fallbackName,
        customer_email: email,
        customer_phone: mobileNumber.number,
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
    };
  }

  async #sendRequest(
    requestData: CashfreeCreateDepositRequest,
  ): Promise<CashfreeCreateOrderApiResponse> {
    const {
      headers,
      urls: { baseUrl },
    } = config.payment.cashfree.deposit;
    return await this.httpClientService.post<CashfreeCreateOrderApiResponse>(
      baseUrl,
      requestData,
      { headers },
    );
  }

  async #generatePaymentLink(paymentSessionId: string): Promise<string> {
    const {
      urls: { sessionUrl },
      headers,
    } = config.payment.cashfree.deposit;

    const requestData = {
      payment_session_id: paymentSessionId,
      payment_method: {
        upi: {
          channel: 'link',
        },
      },
    };

    const response = await this.httpClientService.post<CashfreeSessionResponse>(
      sessionUrl,
      requestData,
      {
        headers,
      },
    );
    return response.data.payload.default;
  }

  async #getStatusFromCashfree(orderId: string): Promise<CashfreeOrderStatus> {
    const {
      urls: { baseUrl },
      headers,
    } = config.payment.cashfree.deposit;
    const orderStatusResponse =
      await this.httpClientService.get<CashfreeOrderStatusApiResponse>(
        `${baseUrl}/${orderId}`,
        { headers },
      );

    const { order_status: orderStatus } = orderStatusResponse;
    return orderStatus;
  }

  async #getPaymentMethodFromCashfree(orderId: string): Promise<PaymentMethod> {
    // https://docs.cashfree.com/reference/pgorderfetchpayments
    const {
      urls: { baseUrl },
      headers,
    } = config.payment.cashfree.deposit;
    const paymentDetails = await this.httpClientService.get<
      CashfreePaymentDetails[]
    >(`${baseUrl}/${orderId}/payments`, { headers });

    const successPayment = paymentDetails.find(
      ({ payment_status }) => payment_status === CashfreePaymentStatus.success,
    );

    if (successPayment) {
      const { payment_method: paymentMethod } = successPayment;
      if (paymentMethod[CashfreePaymentMethod.card]) {
        return PaymentMethod.card;
      }
      if (paymentMethod[CashfreePaymentMethod.netbanking]) {
        return PaymentMethod.netbanking;
      }
      if (paymentMethod[CashfreePaymentMethod.upi]) {
        return PaymentMethod.upi;
      }
    }
    this.logger.warn('No successful payment found for order', orderId);
    this.logger.warn(paymentDetails);
    return PaymentMethod.upi;
  }

  #interpretOrderStatus(orderStatus: CashfreeOrderStatus): TxnStatus {
    switch (orderStatus) {
      case CashfreeOrderStatus.ACTIVE: {
        return TxnStatus.pending;
      }
      case CashfreeOrderStatus.PAID: {
        return TxnStatus.success;
      }
    }
    return TxnStatus.failed;
  }

  async getPayoutAccountHolderName(
    payoutType: PayoutType,
    accountNumber?: string,
    ifsc?: string,
    upiId?: string,
  ): Promise<string> {
    return payoutType === PayoutType.UPI
      ? this.#getUpiAccountHolderName(upiId)
      : this.#getBankAccountHolderName(accountNumber as string, ifsc as string);
  }

  async #getUpiAccountHolderName(vpa?: string): Promise<string> {
    const validationResult: CashfreeAccountValidationResult =
      await Cashfree.Payouts.Validation.ValidateUPIDetails({
        name: 'dummy',
        vpa,
      });

    const { data, status } = validationResult;
    const { nameAtBank, accountExists } = data;
    if (status !== 'SUCCESS' || accountExists !== 'YES') {
      throw new BadRequestException(
        `Can't Get UPI details. ${JSON.stringify(validationResult)}`,
      );
    }

    return nameAtBank;
  }

  async #getBankAccountHolderName(
    bankAccount: string,
    ifsc: string,
  ): Promise<string> {
    const validationResult: CashfreeAccountValidationResult =
      await Cashfree.Payouts.Validation.ValidateBankDetails({
        name: 'dummy',
        phone: '1234567890',
        bankAccount,
        ifsc,
      });
    const { data, status, accountStatus } = validationResult;

    if (status !== 'SUCCESS' || accountStatus !== 'VALID') {
      throw new BadRequestException(
        `Can't Get Bank Details. ${JSON.stringify(validationResult)}`,
      );
    }

    return data.nameAtBank;
  }

  async validatePayoutAccount(
    user: UserEntity,
    createPayoutOrderRequest: CreatePayoutOrderRequestDto,
  ): Promise<{ accountHolderName: string; nameMatchResult: NameMatchResult }> {
    await this.#generatePayoutAuthToken();
    const { mobileNumber, name } = user;
    const { accountNumber, ifscCode, upiId, payoutType } =
      createPayoutOrderRequest;
    return payoutType === PayoutType.UPI
      ? this.#validateUpi(name || '', upiId)
      : this.#validateBank({
          name: name || '',
          mobileNumber: mobileNumber.number,
          bankAccount: accountNumber,
          ifsc: ifscCode,
        });
  }

  async #validateUpi(
    name: string,
    vpa?: string,
  ): Promise<{ accountHolderName: string; nameMatchResult: NameMatchResult }> {
    const authToken = await this.#generatePayoutAuthToken();
    const { baseUrl } = config.payment.cashfree.payout;

    const validationResult = await this.httpClientService.get<
      CashfreeApiResponse<{
        nameAtBank: string;
        accountExists: string;
        nameMatchScore: string;
      }>
    >(
      encodeURI(`${baseUrl}/v1/validation/upiDetails?vpa=${vpa}&name=${name}`),
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    const {
      data: { nameAtBank, accountExists, nameMatchScore },
      status,
    } = validationResult;

    if (status !== 'SUCCESS' || accountExists !== 'YES') {
      throw new BadRequestException(
        `UPI Details are not valid for ${name}: ${JSON.stringify(
          validationResult,
        )}`,
      );
    }

    return {
      accountHolderName: nameAtBank,
      nameMatchResult: nameMatchScore
        ? this.#interpretNameMatchScore(nameMatchScore)
        : this.#manualNameMatch(nameAtBank, name),
    };
  }

  async #validateBank({ name, bankAccount, ifsc }: ValidateIMPS): Promise<{
    accountHolderName: string;
    nameMatchResult: NameMatchResult;
  }> {
    const authToken = await this.#generatePayoutAuthToken();
    const { baseUrl } = config.payment.cashfree.payout;

    const validationResult = await this.httpClientService.get<
      CashfreeApiResponse<{
        nameAtBank: string;
        accountExists: string;
        nameMatchScore: string;
      }>
    >(
      encodeURI(
        `${baseUrl}/v1.2/validation/bankDetails?bankAccount=${bankAccount}&ifsc=${ifsc}&name=${name}`,
      ),
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    const {
      data: { nameAtBank, nameMatchScore },
      status,
      accountStatus,
    } = validationResult;

    if (status !== 'SUCCESS' || accountStatus !== 'VALID') {
      throw new BadRequestException(
        `Bank Details are not valid for ${name}: ${JSON.stringify(
          validationResult,
        )}`,
      );
    }

    return {
      accountHolderName: nameAtBank,
      nameMatchResult: nameMatchScore
        ? this.#interpretNameMatchScore(nameMatchScore)
        : this.#manualNameMatch(nameAtBank, name),
    };
  }

  #interpretNameMatchScore(nameMatchScore: string): NameMatchResult {
    const nameMatchScoreInNumber = Number(nameMatchScore);
    if (nameMatchScoreInNumber >= 85) {
      return NameMatchResult.MATCHED;
    }
    if (nameMatchScoreInNumber < 50) {
      return NameMatchResult.NOT_MATCHED;
    }
    return NameMatchResult.PARTIAL_MATCH;
  }

  #manualNameMatch(name1: string, name2: string): NameMatchResult {
    this.logger.warn('Manual Name Match');
    const normalizedName1 = name1.trim().toLowerCase();
    const normalizedName2 = name2.trim().toLowerCase();
    const name1Array = normalizedName1.split(' ');
    const name2Array = normalizedName2.split(' ');
    const matchedNames = name1Array.filter((name) => name2Array.includes(name));
    const matchPercentage = (matchedNames.length / name1Array.length) * 100;
    this.logger.warn(`${name1} => ${name2} => ${matchPercentage}`);
    if (matchPercentage > 90) {
      return NameMatchResult.MATCHED;
    }
    if (matchPercentage < 40) {
      return NameMatchResult.NOT_MATCHED;
    }
    return NameMatchResult.PARTIAL_MATCH;
  }

  async #updateBeneficiary(transferRequest: TransferRequest) {
    const { payoutType, upiId, account, user } = transferRequest;
    const beneficiaryRequest = this.#generateBeneficiaryData(user);

    if (payoutType === PayoutType.IMPS) {
      const { accountNo, ifscCode } = account as Account;
      const beneRez = {
        ...beneficiaryRequest,
        bankAccount: accountNo,
        ifsc: ifscCode,
      };
      await this.#updateBeneficiaryBank(beneRez);
    } else {
      const beneRez = {
        ...beneficiaryRequest,
        vpa: upiId,
      };
      await this.#updateBeneficiaryUpi(beneRez);
    }
  }

  #generateBeneficiaryData(user: UserEntity) {
    const { username, mobileNumber, email, address, userId } = user;
    const { address1, address2, city, state, postalCode } = address as Address;
    return {
      beneId: userId,
      name: username,
      email: email ?? 'ludoempire@gmail.com',
      phone: mobileNumber.number,
      address1: address1 ?? 'Ludo empire',
      address2: address2 ?? 'Ludo empire',
      city: city ?? 'Bangalore',
      state: state,
      postalCode: postalCode ?? '560048',
    };
  }

  async #updateBeneficiaryBank(beneficiaryData: beneficiaryRequest) {
    const { bankAccount, ifsc, beneId } = beneficiaryData;
    const beneficiaryRemovalResponse =
      await Cashfree.Payouts.Beneficiary.Remove({
        beneId,
      });
    const { status, subCode } = beneficiaryRemovalResponse;
    if (!(status === 'SUCCESS' || (status === 'ERROR' && subCode === '404'))) {
      console.log({ beneficiaryRemovalResponse });
      throw new BadRequestException(
        'Failed to process the requst. Please try again lateror contact support for assistance.',
      );
    }
    const beneficiary = await Cashfree.Payouts.Beneficiary.GetBeneId({
      bankAccount,
      ifsc,
    });

    const beneficiaryId = beneficiary.data?.beneId;

    if (beneficiaryId) {
      const beneficiaryRemovalResponse =
        await Cashfree.Payouts.Beneficiary.Remove({
          beneId: beneficiaryId,
        });
      const { status, subCode } = beneficiaryRemovalResponse;
      if (
        !(status === 'SUCCESS' || (status === 'ERROR' && subCode === '404'))
      ) {
        console.log({ beneficiaryRemovalResponse });
        throw new BadRequestException(
          'Failed to process the requst. Please try again lateror contact support for assistance.',
        );
      }
    }

    const beneRez = {
      ...beneficiaryData,
      bankAccount,
      ifsc,
    };
    await Cashfree.Payouts.Beneficiary.Add(beneRez);
  }

  async #updateBeneficiaryUpi(beneficiaryData: beneficiaryRequest) {
    const { beneId } = beneficiaryData;
    const beneficiaryRemovalResponse =
      await Cashfree.Payouts.Beneficiary.Remove({
        beneId,
      });
    const { status, subCode } = beneficiaryRemovalResponse;
    if (!(status === 'SUCCESS' || (status === 'ERROR' && subCode === '404'))) {
      console.log({ beneficiaryRemovalResponse });
      throw new BadRequestException(
        'Failed to process the requst. Please try again lateror contact support for assistance.',
      );
    }

    const beneficiaryDataToAdd = {
      ...beneficiaryData,
      beneId,
    };
    await Cashfree.Payouts.Beneficiary.Add(beneficiaryDataToAdd);
  }

  async initiateTransfer(transferRequest: TransferRequest): Promise<TxnStatus> {
    const {
      amount,
      transferId,
      payoutType,
      user: { userId },
    } = transferRequest;
    await this.#updateBeneficiary(transferRequest);

    const transferResponse = await Cashfree.Payouts.Transfers.RequestTransfer({
      beneId: userId,
      amount,
      transferId,
      transferMode: payoutType === PayoutType.IMPS ? 'imps' : 'upi',
    });

    this.logger.debug(
      `Cashfree Payout ${userId} Transfer Request Response, ${JSON.stringify(
        transferResponse,
      )}`,
    );
    return this.#interpretPayoutStatus(transferResponse.status);
  }

  #interpretPayoutStatus(orderStatus: CashfreeOrderStatus) {
    switch (orderStatus) {
      case CashfreeOrderStatus.PENDING: {
        return TxnStatus.pending;
      }
      case CashfreeOrderStatus.SUCCESS: {
        return TxnStatus.success;
      }
    }

    return TxnStatus.refund;
  }

  async getPayoutStatusFromGateway(order: PaymentEntity): Promise<TxnStatus> {
    const transferStatus = await Cashfree.Payouts.Transfers.GetTransferStatus({
      transferId: order.id,
    });
    return this.#interpretPayoutStatus(transferStatus.data.transfer.status);
  }

  async #generatePayoutAuthToken(): Promise<string> {
    const { baseUrl, clientId, clientSecret } = config.payment.cashfree.payout;
    const { status, message, data } = await this.httpClientService.post<
      CashfreeApiResponse<{ token: string }>
    >(
      `${baseUrl}/v1/authorize`,
      {},
      {
        headers: {
          'x-client-id': clientId,
          'x-client-secret': clientSecret,
        },
      },
    );
    if (status !== 'SUCCESS') {
      throw new InternalServerErrorException(
        `Failed to generate Cashfree auth token: ${message}`,
      );
    }
    return data.token;
  }

  async compareNames(name1: string, name2: string): Promise<NameMatchResult> {
    // TODO: Cashfree Name Match feature can be used
    return this.#manualNameMatch(name1, name2);
  }
}
