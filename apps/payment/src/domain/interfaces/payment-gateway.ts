import {
  Gateway,
  PaymentMethod,
  PayoutType,
  TransferRequest,
  TxnStatus,
} from '@lib/fabzen-common/types/payment.types';

import { CreateDepositOrderResponseDto } from '../../infrastructure/controllers/dtos/deposit.transporter.dto';
import { PaymentEntity, UserEntity } from '@lib/fabzen-common/entities';
import { CreatePayoutOrderRequestDto } from '../../infrastructure/controllers/dtos/payout.transporter.dto';

export type CreateDepositOrder = {
  orderId: string;
  userId: string;
  amount: string;
  paymentMethod: PaymentMethod;
  user: UserEntity;
};

export enum NameMatchResult {
  MATCHED = 'MATCHED',
  PARTIAL_MATCH = 'PARTIAL_MATCH',
  NOT_MATCHED = 'NOT_MATCHED',
}

export abstract class PaymentGateway {
  private readonly gatewayName: Gateway;

  constructor(gatewayName: Gateway) {
    this.gatewayName = gatewayName;
  }

  getGatewayName(): Gateway {
    return this.gatewayName;
  }

  abstract createDepositOrder(
    request: CreateDepositOrder,
  ): Promise<CreateDepositOrderResponseDto>;

  abstract getDepositOrderStatus(
    orderId: string,
  ): Promise<{ updatedStatus: TxnStatus; paymentMethod: string }>;
  abstract validatePayoutAccount(
    user: UserEntity,
    createPayoutOrderRequest: CreatePayoutOrderRequestDto,
  ): Promise<{ accountHolderName: string; nameMatchResult: NameMatchResult }>;
  abstract getPayoutAccountHolderName(
    payoutType: PayoutType,
    accountNumber?: string,
    ifsc?: string,
    upiId?: string,
  ): Promise<string>;
  abstract initiateTransfer(
    transferRequest: TransferRequest,
  ): Promise<TxnStatus>;
  abstract getPayoutStatusFromGateway(order: PaymentEntity): Promise<TxnStatus>;
  abstract compareNames(name1: string, name2: string): Promise<NameMatchResult>;
}
