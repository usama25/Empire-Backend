import Big from 'big.js';
import * as dayjs from 'dayjs';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import {
  FinancialYearDates,
  Gateway,
  PayoutType,
  TaxDeduction,
  TxnModes,
  TxnStatus,
  UpdateOrderDto,
} from '@lib/fabzen-common/types/payment.types';
import { config } from '@lib/fabzen-common/configuration';
import { generateRandomOrderId } from '@lib/fabzen-common/utils/random.utils';
import { PaymentEntity, UserEntity } from '@lib/fabzen-common/entities';
import {
  Country,
  HistoryParameters,
  TransporterProviders,
} from '@lib/fabzen-common/types';
import { TaxConfig } from '@lib/fabzen-common/remote-config/remote-config.types';
import { capitalize } from '@lib/fabzen-common/utils/string.utils';
import { AppsflyerEventNames } from '@lib/fabzen-common/types/notification.types';

import { PayoutHistoryResponseDto } from 'apps/rest-api/src/subroutes/payment/payout/payout.dto';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { NotificationProvider } from 'apps/notification/src/notification.provider';
import {
  NameMatchResult,
  PaymentGateway,
  PaymentRepository,
} from '../interfaces';
import { WalletRepository } from 'apps/wallet/src/domain/interfaces';
import {
  CreatePayoutOrderRequestDto,
  CreatePayoutOrderResponseDto,
} from '../../infrastructure/controllers/dtos/payout.transporter.dto';
import { PaymentGatewayFactory } from '../../infrastructure/gateways';

type WithdrawalLimits = {
  maxWithdrawalLimit: number;
  minUpiWithdrawalLimit: number;
  minBankWithdrawalLimit: number;
  kycWithdrawalLimit: number;
  maxWithdrawalsPerDay: number;
  maxLifetimeWithdrawalLimit: number;
};

@Injectable()
export class PayoutUseCases {
  private readonly notificationProvider: NotificationProvider;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly httpClientService: HttpClientService,
    private readonly remoteConfigService: RemoteConfigService,
    private readonly walletRepository: WalletRepository,
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
  ) {
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );
  }

  async createPayoutOrder(
    request: CreatePayoutOrderRequestDto,
  ): Promise<CreatePayoutOrderResponseDto> {
    const { userId, payoutType, amount, accountNumber, ifscCode, upiId } =
      request;
    const user = await this.#getUser(userId);

    await this.#validatePayoutLimit(user, request);

    const {
      isAccountAlreadyValidated,
      isEverManuallyApproved,
      accountHolderName,
    } =
      await this.paymentRepository.checkIfPayoutAccountAlreadyValidated(
        request,
      );
    console.log({
      isAccountAlreadyValidated,
      isEverManuallyApproved,
      accountHolderName,
    });
    // TODO: put in a separate function
    let needManualReview = false;
    if (
      isAccountAlreadyValidated &&
      !isEverManuallyApproved &&
      this.#isMoreThanKycWithdrawalLimit(user, request)
    ) {
      const nameMatchResult = await this.#compareNames(
        accountHolderName,
        user.name as string,
      );
      if (nameMatchResult === NameMatchResult.NOT_MATCHED) {
        throw new BadRequestException(
          `Name at bank account ${accountHolderName} does not match with KYC name ${user.name}`,
        );
      }
      needManualReview = nameMatchResult === NameMatchResult.PARTIAL_MATCH;
    }
    if (!isAccountAlreadyValidated) {
      const { accountHolderName, nameMatchResult } =
        await this.#validatePayoutAccount(user, request);
      needManualReview = this.#validateAccountNameIfExceedsKycLimit(
        user,
        request,
        accountHolderName,
        nameMatchResult,
      );

      await this.paymentRepository.savePayoutAccount({
        userId,
        accountHolderName,
        accountNumber,
        ifsc: ifscCode,
        upiId,
      });
    }

    const orderId = generateRandomOrderId();

    await this.#debitFromWinWallet(user, amount, orderId);

    const tds = await this.#getTdsAmount(amount, userId);

    const country = (user.address?.country ?? Country.India) as Country;

    const { isTaxDeductionEnabled } = this.#getTaxStatuses(country);

    const paymentGateway = this.#choosePaymentGatway();

    const accountVerificationCharges = isAccountAlreadyValidated
      ? '0'
      : this.remoteConfigService.getPayoutAccountVerificationCharges();
    const settledAmount = Big(
      isTaxDeductionEnabled ? tds.withdrawalAmountAfterTaxDeduction : amount,
    )
      .minus(accountVerificationCharges)
      .toFixed(2);
    const order = await this.paymentRepository.createPayoutOrder({
      userId,
      amount,
      orderId,
      gateway: paymentGateway.getGatewayName(),
      mode: TxnModes.withdrawal,
      status:
        needManualReview && !isEverManuallyApproved
          ? TxnStatus.manualReview
          : TxnStatus.pending,
      payoutType,
      account: {
        accountNo: accountNumber,
        ifscCode: ifscCode,
      },
      upiId,
      taxdeduction: tds,
      settledAmount,
      isPlayStoreBuild: user.isPlayStoreUser,
      accountVerificationCharges,
    });

    if (needManualReview) {
      return { status: TxnStatus.manualReview, orderId, amount };
    } else {
      const transferStatus = await paymentGateway.initiateTransfer({
        amount: settledAmount,
        user,
        transferId: order.id,
        payoutType,
        orderId,
        account: {
          accountNo: accountNumber,
          ifscCode: ifscCode,
        },
        upiId,
      });
      await this.#getAndUpdatePayoutOrderStatus(order);

      return { status: transferStatus, orderId, amount };
    }
  }

  async #getUser(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.getUser(userId);
    if (!user) {
      throw new NotFoundException(`User Not Found ${userId}`);
    }
    return user;
  }

  #choosePaymentGatway(gateway?: Gateway): PaymentGateway {
    const gatewayName =
      gateway ?? this.remoteConfigService.getPaymentGatewayNameForPayout();
    const paymentGateway = PaymentGatewayFactory.make(
      gatewayName,
      this.httpClientService,
    );
    return paymentGateway;
  }

  async #compareNames(
    name1: string,
    name2: string,
    gateway?: Gateway,
  ): Promise<NameMatchResult> {
    const paymentGateway = this.#choosePaymentGatway(gateway);
    return paymentGateway.compareNames(name1, name2);
  }

  async #validatePayoutLimit(
    user: UserEntity,
    request: CreatePayoutOrderRequestDto,
  ) {
    const { isPlayStoreUser } = user;
    const withdrawalLimits = this.#getWithdrawalLimits(isPlayStoreUser);

    this.#checkWinWalletBalanceForPayout(user, request);
    this.#checkMinWithdrawalLimit(request, withdrawalLimits);
    this.#checkMaxWithdrawalLimit(request, withdrawalLimits);
    this.#checkLimitForNoKycUser(user, request, withdrawalLimits);
    await this.#checkDailyWithdrawalCount(user, withdrawalLimits);

    if (isPlayStoreUser) {
      await this.#checkLifetimeWithdrawalLimit(user, request, withdrawalLimits);
    }
  }

  #checkWinWalletBalanceForPayout(
    { wallet: { win } }: UserEntity,
    { amount }: CreatePayoutOrderRequestDto,
  ) {
    if (Big(win).lt(Big(amount))) {
      throw new BadRequestException(
        `Insufficient balance in your win Wallet. Current balance: ${amount}`,
      );
    }
  }

  #getWithdrawalLimits(isPlayStoreUser: boolean): WithdrawalLimits {
    const payoutLimit = this.remoteConfigService.getPayoutLimit();
    const freeVersionPayoutLimit =
      this.remoteConfigService.getFreeVersionPayoutLimit();
    const { autoTransferLimit, kycWithdrawalLimit } = payoutLimit;

    const maxWithdrawalsPerDay = (
      isPlayStoreUser ? freeVersionPayoutLimit : payoutLimit
    ).maxWithdrawalsPerDay;

    return {
      maxWithdrawalLimit: Number(autoTransferLimit),
      minUpiWithdrawalLimit: Number(
        (isPlayStoreUser ? freeVersionPayoutLimit : payoutLimit)
          .upiWithdrawalLimit,
      ),
      minBankWithdrawalLimit: Number(
        (isPlayStoreUser ? freeVersionPayoutLimit : payoutLimit)
          .bankWithdrawalLimit,
      ),
      kycWithdrawalLimit: Number(kycWithdrawalLimit),
      maxWithdrawalsPerDay: Number(maxWithdrawalsPerDay),
      maxLifetimeWithdrawalLimit: Number(
        freeVersionPayoutLimit.maxLifetimeWithdrawalLimit,
      ),
    };
  }

  #checkMinWithdrawalLimit(
    { amount, payoutType }: CreatePayoutOrderRequestDto,
    { minUpiWithdrawalLimit, minBankWithdrawalLimit }: WithdrawalLimits,
  ) {
    const minWithdrawalLimit =
      payoutType === PayoutType.IMPS
        ? minBankWithdrawalLimit
        : minUpiWithdrawalLimit;
    if (Big(amount).lt(minWithdrawalLimit)) {
      throw new BadRequestException(
        `Minimum Payout limit is ${minWithdrawalLimit}`,
      );
    }
  }

  #checkMaxWithdrawalLimit(
    { amount }: CreatePayoutOrderRequestDto,
    { maxWithdrawalLimit }: WithdrawalLimits,
  ) {
    if (Big(amount).gt(maxWithdrawalLimit)) {
      throw new BadRequestException(
        `Maximum Payout limit is ${maxWithdrawalLimit}, Please try again`,
      );
    }
  }

  async #checkDailyWithdrawalCount(
    { userId }: UserEntity,
    { maxWithdrawalsPerDay }: WithdrawalLimits,
  ) {
    const payoutCount =
      await this.paymentRepository.getDailyPayoutCount(userId);

    if (payoutCount >= Number(maxWithdrawalsPerDay)) {
      throw new BadRequestException(
        `you've reached the maximum daily withdrawal limit ${maxWithdrawalsPerDay}.
        Please wait until tomorrow to make another withdrawal.`,
      );
    }
  }

  #checkLimitForNoKycUser(
    { isKycVerified }: UserEntity,
    { amount }: CreatePayoutOrderRequestDto,
    { kycWithdrawalLimit }: WithdrawalLimits,
  ) {
    if (!isKycVerified && Big(amount).gt(Big(kycWithdrawalLimit))) {
      throw new BadRequestException(
        `Your KYC is Pending, Please submit your KYC details`,
      );
    }
  }

  async #checkLifetimeWithdrawalLimit(
    { userId }: UserEntity,
    { amount }: CreatePayoutOrderRequestDto,
    { maxLifetimeWithdrawalLimit }: WithdrawalLimits,
  ) {
    const totalWithdrawalAmount =
      await this.paymentRepository.getTotalWithdrawalAmount(userId);
    if (Big(totalWithdrawalAmount).add(amount).gt(maxLifetimeWithdrawalLimit)) {
      let errorMessage =
        "You've reached the maximum withdrawal limit for this version.";
      if (Big(totalWithdrawalAmount).lt(maxLifetimeWithdrawalLimit)) {
        const maxAllowedAmount = Big(maxLifetimeWithdrawalLimit)
          .sub(totalWithdrawalAmount)
          .toFixed(2)
          .toString();
        errorMessage = `You can withdraw up to ₹${maxAllowedAmount} only.`;
      }
      throw new BadRequestException(errorMessage);
    }
  }

  async #debitFromWinWallet(
    { userId }: UserEntity,
    amount: string,
    orderId: string,
  ) {
    await this.walletRepository.debitPayoutFromWallet({
      userId,
      amount,
      orderId,
    });
  }

  #getTaxStatuses(country: string): TaxConfig {
    const { isTaxDeductionEnabled, isTaxCashbackEnabled } =
      this.remoteConfigService.getTaxStatuses();
    return {
      isTaxDeductionEnabled: country === Country.India && isTaxDeductionEnabled,
      isTaxCashbackEnabled: country === Country.India && isTaxCashbackEnabled,
    };
  }

  async #validatePayoutAccount(
    user: UserEntity,
    createPayoutOrderRequest: CreatePayoutOrderRequestDto,
    // return `needManualReview`
  ): Promise<{ accountHolderName: string; nameMatchResult: NameMatchResult }> {
    const paymentGateway = this.#choosePaymentGatway();
    return paymentGateway.validatePayoutAccount(user, createPayoutOrderRequest);
  }

  #validateAccountNameIfExceedsKycLimit(
    user: UserEntity,
    createPayoutOrderRequest: CreatePayoutOrderRequestDto,
    accountHolderName: string,
    nameMatchResult: NameMatchResult,
    // return `needManualReview`
  ): boolean {
    if (!this.remoteConfigService.isNameVerificationForPayoutEnabled()) {
      return false;
    }
    if (this.#isMoreThanKycWithdrawalLimit(user, createPayoutOrderRequest)) {
      if (nameMatchResult === NameMatchResult.NOT_MATCHED) {
        throw new BadRequestException(
          `Name at bank account ${accountHolderName} does not match with KYC name ${user.name}`,
        );
      } else {
        return nameMatchResult === NameMatchResult.PARTIAL_MATCH;
      }
    }
    return false;
  }

  #isMoreThanKycWithdrawalLimit(
    user: UserEntity,
    createPayoutOrderRequest: CreatePayoutOrderRequestDto,
  ): boolean {
    const { isKycVerified, isPlayStoreUser } = user;
    const { amount } = createPayoutOrderRequest;
    const { kycWithdrawalLimit } = this.#getWithdrawalLimits(isPlayStoreUser);
    return isKycVerified && Big(amount).gt(Big(kycWithdrawalLimit));
  }

  async #getTdsAmount(amount: string, userId: string): Promise<TaxDeduction> {
    const { transactionDateFrom, lastPayoutAmount } =
      await this.calculateTransactionDate(userId);

    const transactionToDate = new Date();
    const totalDepositAmount =
      await this.paymentRepository.getTotalDepositAmountInRange(
        userId,
        transactionDateFrom,
        transactionToDate,
      );

    const calculatedTds = this.calculateTdsAmount(
      totalDepositAmount,
      amount,
      lastPayoutAmount,
    );

    const {
      netWithdrawalAmount,
      amountAfterTDSDeduction,
      tdsAmount,
      isTdsDeducted,
    } = calculatedTds;

    const payloadForTdsCollection = {
      userId,
      transactionFrom: transactionDateFrom,
      transactionTo: transactionToDate,
      totalDepositAmount,
      totalWithdrawalAmount: amount,
      withdrawalAmountAfterTaxDeduction: String(amountAfterTDSDeduction),
      netWithdrawalAmount: netWithdrawalAmount,
      totalTdsAmountDeducted: tdsAmount,
      isTdsDeducted,
      financialYear: this.getCurrentFinancialYear(),
    };

    return payloadForTdsCollection;
  }

  async calculateTransactionDate(userId: string) {
    let transactionDateFrom!: Date;
    let lastPayoutAmount = '0';

    const lastTdsRecord = await this.paymentRepository.getLastTdsRecord(userId);

    if (lastTdsRecord) {
      const { isTdsDeducted, transactionTo, transactionFrom } = lastTdsRecord;

      transactionDateFrom = isTdsDeducted ? transactionTo : transactionFrom;

      if (!isTdsDeducted) {
        lastPayoutAmount = String(
          await this.paymentRepository.getTotalPayoutAmountInRange(
            userId,
            transactionDateFrom,
            new Date(),
          ),
        );
      }
    } else {
      const financialYearDates =
        this.getFinancialYearDates() as FinancialYearDates;
      transactionDateFrom = financialYearDates?.yearStart;
    }

    return { transactionDateFrom, lastPayoutAmount };
  }

  calculateTdsAmount(
    totalDepositAmount: string,
    amountRequested: string,
    lastRequestedAmount: string,
  ) {
    const amountRequestedInBig = Big(amountRequested);
    const totalWithdrawalAmount =
      amountRequestedInBig.plus(lastRequestedAmount);
    const netWithdrawalAmount = Big(totalWithdrawalAmount).minus(
      totalDepositAmount,
    );

    let tdsAmount: Big = Big(0);

    const taxFreeWithdrawalLimit =
      this.remoteConfigService.getPayoutLimit().taxFreeWithdrawalLimit;

    if (
      amountRequestedInBig.gt(taxFreeWithdrawalLimit) &&
      netWithdrawalAmount.gt(0)
    ) {
      tdsAmount = Big(
        Big(netWithdrawalAmount).gt(amountRequested)
          ? amountRequested
          : netWithdrawalAmount,
      ).times(Big(config.payment.cashfree.payout.tdsPercentage));
    }

    const amountAfterTDSDeduction = amountRequestedInBig.minus(tdsAmount);

    return {
      amountAfterTDSDeduction: amountAfterTDSDeduction.toFixed(2),
      tdsAmount: tdsAmount.toString(),
      netWithdrawalAmount: netWithdrawalAmount.toFixed(2),
      totalWithdrawalAmount: totalWithdrawalAmount.toFixed(2),
      isTdsDeducted: tdsAmount.gt(0),
    };
  }

  getCurrentFinancialYear(): string {
    const now = dayjs();
    const currentYear = now.year();
    const currentMonth = now.month() + 1;
    let financialYear = '';
    financialYear =
      currentMonth <= 3
        ? `${currentYear - 1}-${currentYear.toString()}`
        : `${currentYear}-${(currentYear + 1).toString()}`;

    return financialYear;
  }

  getFinancialYearDates(): object {
    const financialYear = this.getCurrentFinancialYear();
    const years = financialYear.split('-');
    const financialYearDates: FinancialYearDates = {
      yearStart: dayjs(`${years[0]}-04-01`).startOf('d').toDate(),
      yearEnd: dayjs(`${years[1]}-03-31`).endOf('d').toDate(),
    };
    return financialYearDates;
  }

  async #updatePayoutOrderStatus(
    order: PaymentEntity,
    transferStatus: TxnStatus,
  ) {
    const {
      userId,
      amount,
      settledAmount,
      orderId,
      accountVerificationCharges,
    } = order;
    const updateOrderDto: UpdateOrderDto = {
      status: transferStatus,
      settledAmount:
        transferStatus === TxnStatus.refund ? amount : settledAmount,
    };
    if (transferStatus === TxnStatus.refund) {
      await this.#initiatePayoutRefund(order);
    }
    const country = await this.userRepository.getUserCountry(userId);
    const { isTaxDeductionEnabled, isTaxCashbackEnabled } =
      this.#getTaxStatuses(country);
    if (
      transferStatus === TxnStatus.success &&
      isTaxDeductionEnabled &&
      isTaxCashbackEnabled
    ) {
      const tdsAmount = settledAmount
        ? Big(amount)
            .minus(settledAmount)
            .minus(accountVerificationCharges ?? 0)
            .toFixed(2)
        : '0';
      await this.walletRepository.creditTaxRewardToWallet({
        userId,
        amount: tdsAmount,
        orderId,
      });

      this.notificationProvider.sendInAppEvent(
        userId,
        AppsflyerEventNames.withdraw,
        amount,
      );
    }

    await this.paymentRepository.updatePayoutOrder(orderId, updateOrderDto);

    if (transferStatus !== TxnStatus.pending) {
      this.#sendPushNotificationForPayoutStatus(userId, amount, transferStatus);
    }
  }

  #sendPushNotificationForPayoutStatus(
    userId: string,
    amount: string,
    status: TxnStatus,
  ) {
    const notificationTitle = 'Withdrawal Status';
    const notificationContent = `₹${amount} Withdrawal ${capitalize(status)}`;
    const deepLink = config.notification.deepLinks.withdrawal;
    this.notificationProvider.sendPushNotification(
      userId,
      notificationTitle,
      notificationContent,
      deepLink,
    );
  }

  async #initiatePayoutRefund(order: PaymentEntity) {
    const { orderId, userId, amount, accountVerificationCharges } = order;
    const amountToRefund = Big(amount)
      .minus(accountVerificationCharges ?? '0')
      .toFixed(2);
    const refundExists =
      await this.paymentRepository.checkRefundExists(orderId);
    if (refundExists) {
      throw new BadRequestException('Refund is already Processed', orderId);
    }
    await this.paymentRepository.deleteTdsRecord(orderId);
    await this.walletRepository.creditPayoutRefundToWallet({
      userId,
      amount: amountToRefund,
      orderId,
    });
  }

  async getHistory(
    historyParameters: HistoryParameters,
  ): Promise<PayoutHistoryResponseDto> {
    return await this.paymentRepository.getPayoutHistory(historyParameters);
  }

  async webhookJuspay(orderId: string) {
    const order = await this.paymentRepository.getOrder(orderId);
    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }
    await this.#getAndUpdatePayoutOrderStatus(order);
  }

  async webhookCashfree(transferId: string) {
    const order = await this.paymentRepository.getOrderById(transferId);
    if (!order) {
      return;
    }
    await this.#getAndUpdatePayoutOrderStatus(order);
  }

  async #getAndUpdatePayoutOrderStatus(order: PaymentEntity) {
    const { gateway } = order;
    const paymentGateway = this.#choosePaymentGatway(gateway);

    if (!order.isFinalized()) {
      const updatedStatus =
        await paymentGateway.getPayoutStatusFromGateway(order);
      await this.#updatePayoutOrderStatus(order, updatedStatus);
    }
  }

  async convertToMain(
    userId: string,
    amount: string,
  ): Promise<CreatePayoutOrderResponseDto> {
    await this.#checkWinWalletBalance(userId, amount);
    const orderId = generateRandomOrderId();
    const conversionReward = this.#calculateConversionReward(amount);
    const amountToCredit = Big(amount).add(conversionReward).toFixed(2);
    await this.walletRepository.convertToMain(
      userId,
      orderId,
      amount,
      conversionReward,
    );
    await this.paymentRepository.createPayoutOrder({
      userId,
      orderId,
      mode: TxnModes.convert,
      amount,
      settledAmount: amountToCredit,
      status: TxnStatus.success,
    });
    return {
      orderId,
      status: TxnStatus.success,
      amount,
    };
  }

  async #checkWinWalletBalance(userId: string, amount: string) {
    const wallet = await this.walletRepository.getWallet(userId);
    if (!wallet) {
      throw new BadRequestException('User has no wallet');
    }
    const { win } = wallet;
    if (Big(win).lt(Big(amount))) {
      throw new BadRequestException(`Insufficient Wallet Balance`);
    }
  }

  #calculateConversionReward(amount: string): string {
    const commissions = this.remoteConfigService.getCommissions();
    const { conversionCommission } = commissions; // "5" => 5%
    return Big(amount).mul(conversionCommission).div(100).toFixed(2);
  }

  async manuallyApproveWithdrawal(orderId: string) {
    const order = await this.paymentRepository.getOrder(orderId);
    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }
    const {
      id,
      status,
      gateway,
      settledAmount,
      userId,
      payoutType,
      account,
      upiId,
    } = order;
    if (status !== TxnStatus.manualReview) {
      throw new BadRequestException(
        `Order is not in manual review status: ${orderId}`,
      );
    }
    await this.paymentRepository.approvePayoutAccount({
      userId,
      accountNumber: account?.accountNo,
      ifsc: account?.ifscCode,
      upiId,
    });
    const user = await this.#getUser(userId);
    const paymentGateway = this.#choosePaymentGatway(gateway);

    await paymentGateway.initiateTransfer({
      amount: settledAmount as string,
      user,
      transferId: id,
      payoutType: payoutType as PayoutType,
      orderId,
      account,
      upiId,
    });

    await this.#getAndUpdatePayoutOrderStatus(order);
  }

  async manuallyRejectWithdrawal(orderId: string) {
    const order = await this.paymentRepository.getOrder(orderId);
    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }
    if (order.status !== TxnStatus.manualReview) {
      throw new BadRequestException(
        `Order is not in manual review status: ${orderId}`,
      );
    }
    await this.#initiatePayoutRefund(order);
    await this.paymentRepository.updateOrder(orderId, {
      status: TxnStatus.refund,
    });
  }

  async manuallyVerifyWithdrawal(orderId: string) {
    const order = await this.paymentRepository.getOrder(orderId);
    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }
    const { status, gateway, userId, account, upiId, payoutType } = order;
    if (status !== TxnStatus.manualReview) {
      throw new BadRequestException(
        `Order is not in manual review status: ${orderId}`,
      );
    }

    const paymentGateway = this.#choosePaymentGatway(gateway);

    const accountHolderName = await paymentGateway.getPayoutAccountHolderName(
      payoutType as PayoutType,
      account?.accountNo,
      account?.ifscCode,
      upiId,
    );

    const { name } = await this.#getUser(userId);

    return {
      kycName: name,
      accountHolderName,
    };
  }

  async getVerifiedWithdrawalAccounts(userId: string) {
    return await this.paymentRepository.getVerifiedWithdrawalAccounts(userId);
  }
}
