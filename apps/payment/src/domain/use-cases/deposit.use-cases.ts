import Big from 'big.js';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { TxnStatus } from '@lib/fabzen-common/types/payment.types';
import { PaymentEntity, UserEntity } from '@lib/fabzen-common/entities';
import { capitalize } from '@lib/fabzen-common/utils/string.utils';
import { config } from '@lib/fabzen-common/configuration';
import { AppsflyerEventNames } from '@lib/fabzen-common/types/notification.types';
import { GstConfig } from '@lib/fabzen-common/remote-config/remote-config.types';
import {
  Country,
  HistoryParameters,
  TransporterProviders,
} from '@lib/fabzen-common/types';

import { PaymentGateway, PaymentRepository } from '../interfaces';
import {
  CreateDepositOrderRequestDto,
  CreateDepositOrderResponseDto,
} from '../../infrastructure/controllers/dtos/deposit.transporter.dto';
import { PaymentGatewayFactory } from '../../infrastructure/gateways';
import { WalletRepository } from 'apps/wallet/src/domain/interfaces';
import { DepositHistoryResponseDto } from 'apps/rest-api/src/subroutes/payment/deposit/deposit.dto';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { NotificationProvider } from 'apps/notification/src/notification.provider';
import { generateRandomOrderId } from '@lib/fabzen-common/utils/random.utils';
import { sendPurchaseEventToMeta } from '@lib/fabzen-common/utils/meta.util';

@Injectable()
export class DepositUseCases {
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

  async createDepositOrder(
    createDepositOrderRequest: CreateDepositOrderRequestDto,
  ): Promise<CreateDepositOrderResponseDto> {
    const { userId, amount, paymentMethod } = createDepositOrderRequest;
    const user = await this.#getUser(userId);
    const paymentGateway = this.#choosePaymentGatway();
    const orderId = generateRandomOrderId();

    if (!user) {
      throw new NotFoundException(`User Not Found ${userId}`);
    }

    const depositOrderResponse = await paymentGateway.createDepositOrder({
      orderId,
      userId,
      amount,
      paymentMethod,
      user,
    });

    await this.paymentRepository.createDepositOrder({
      userId,
      amount,
      orderId,
      gateway: paymentGateway.getGatewayName(),
      paymentMethod,
    });

    return depositOrderResponse;
  }

  async getDepositOrderStatus(
    orderId: string,
  ): Promise<{ status: TxnStatus; amount: string }> {
    const order = await this.#getOrder(orderId);
    const { gateway, status, amount } = order;

    if (order.isFinalized()) {
      return { status, amount };
    }

    const paymentGateway = PaymentGatewayFactory.make(
      gateway,
      this.httpClientService,
    );
    const { updatedStatus, paymentMethod } =
      await paymentGateway.getDepositOrderStatus(orderId);
    if (updatedStatus === status) {
      return { status, amount };
    } else {
      await this.#updateDepositOrderStatus(order, updatedStatus, paymentMethod);
      return { status: updatedStatus, amount };
    }
  }

  #choosePaymentGatway(): PaymentGateway {
    const gatewayName =
      this.remoteConfigService.getPaymentGatewayNameForDeposit();
    const paymentGateway = PaymentGatewayFactory.make(
      gatewayName,
      this.httpClientService,
    );
    return paymentGateway;
  }

  async #getUser(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.getUser(userId);
    if (!user) {
      throw new NotFoundException(`User Not Found ${userId}`);
    }
    return user;
  }

  async #getOrder(orderId: string): Promise<PaymentEntity> {
    const order = await this.paymentRepository.getOrder(orderId);
    if (!order) {
      throw new NotFoundException(`Order Not Found ${orderId}`);
    }
    return order;
  }

  #getGstStatuses(country: string): GstConfig {
    const { isGstDeduction, isGstCashback } =
      this.remoteConfigService.getGstStatuses();
    return {
      isGstDeduction: country === Country.India && isGstDeduction,
      isGstCashback: country === Country.India && isGstCashback,
    };
  }

  async #updateDepositOrderStatus(
    order: PaymentEntity,
    updatedStatus: TxnStatus,
    paymentMethod: string,
  ) {
    const { orderId, amount, userId } = order;
    const gstAmount = this.calculateGstAmount(amount);
    const country = await this.userRepository.getUserCountry(userId);
    const { isGstDeduction, isGstCashback } = this.#getGstStatuses(country);

    const settledAmount = isGstDeduction
      ? Big(amount).minus(gstAmount).toString()
      : amount;

    const updateOrderDto = {
      status: updatedStatus,
      settledAmount,
      paymentMethod,
    };

    await this.paymentRepository.updateOrder(orderId, updateOrderDto);
    if (updatedStatus === TxnStatus.success) {
      //send purchase event to meta
      const user = await this.#getUser(userId);
      const ipAddress = user.ipAddress;
      const email = user.email;
      const id = user.userId;
      const mobileNumber = user.mobileNumber;
      const shortCountryName = country.slice(0, 2).toLowerCase();
      sendPurchaseEventToMeta(
        id,
        String(ipAddress || '0.0.0.0'),
        shortCountryName,
        String(email || ''),
        mobileNumber.number,
        amount,
      );

      await this.#creditReferralBonus(userId, amount);
      const amountToCredit =
        isGstDeduction && isGstCashback ? amount : settledAmount;
      await this.walletRepository.creditDepositToWallet({
        userId,
        amount: amountToCredit,
        orderId,
      });
      this.notificationProvider.sendInAppEvent(
        userId,
        AppsflyerEventNames.deposit,
        amount.toString(),
      );
    }

    this.#sendPushNotificationForDepositStatus(userId, amount, updatedStatus);
  }

  #sendPushNotificationForDepositStatus(
    userId: string,
    amount: string,
    status: TxnStatus,
  ) {
    const notificationTitle = 'Deposit Status';
    const notificationContent = `₹${amount} Deposit ${capitalize(status)}`;
    const deepLink = config.notification.deepLinks.deposit;
    this.notificationProvider.sendPushNotification(
      userId,
      notificationTitle,
      notificationContent,
      deepLink,
    );
  }

  calculateGstAmount(amount: string): string {
    const gstAmount = Big(amount).mul(28).div(128).round(2).toString();
    return gstAmount;
  }

  async getHistory(
    historyParameters: HistoryParameters,
  ): Promise<DepositHistoryResponseDto> {
    return await this.paymentRepository.getDepositHistory(historyParameters);
  }

  async #creditReferralBonus(userId: string, amount: string) {
    const referralCommission = this.remoteConfigService.getReferralCommission();
    const referralAmount = Big(amount)
      .times(referralCommission)
      .div(100)
      .toFixed(2)
      .toString();
    const referredUserId = await this.userRepository.getReferredUserId(userId);
    if (referredUserId) {
      await this.walletRepository.creditReferralBonus({
        userId,
        referredUserId,
        amount: referralAmount,
      });
    }
  }

  async getConversionRate(userId: string) {
    return await this.paymentRepository.getConversionRate(userId);
  }

  async generateInvoice(orderId: string, overwrite: boolean) {
    return await this.paymentRepository.generateInvoice(orderId, overwrite);
  }
}
