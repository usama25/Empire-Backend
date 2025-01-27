import { PaymentEntity } from '@lib/fabzen-common/entities';
import { HistoryParameters } from '@lib/fabzen-common/types';
import {
  SaveDepositOrderDto,
  SavePayoutOrderDto,
  TaxDeduction,
  UpdateOrderDto,
} from '@lib/fabzen-common/types/payment.types';
import {
  ConversionRateResponseDto,
  DepositHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/payment/deposit/deposit.dto';
import {
  CreatePayoutOrderRequestDto,
  PayoutHistoryResponseDto,
  TdsDetailsResponse,
  VerifiedWithdrawalAccountDto,
} from 'apps/rest-api/src/subroutes/payment/payout/payout.dto';

export abstract class PaymentRepository {
  abstract createDepositOrder(
    order: SaveDepositOrderDto,
  ): Promise<PaymentEntity>;
  abstract getOrder(orderId: string): Promise<PaymentEntity | undefined>;
  abstract updateOrder(
    orderId: string,
    updateOrderdto: UpdateOrderDto,
  ): Promise<void>;
  abstract getDailyPayoutCount(userId: string): Promise<number>;
  abstract createPayoutOrder(order: SavePayoutOrderDto): Promise<PaymentEntity>;
  abstract getTotalDepositAmountInRange(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<string>;
  abstract getTotalPayoutAmountInRange(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<string>;
  abstract getTotalWithdrawalAmount(userId: string): Promise<string>;

  abstract getLastTdsRecord(userId: string): Promise<TaxDeduction | undefined>;
  abstract checkRefundExists(orderId: string): Promise<boolean>;
  abstract updatePayoutOrder(
    orderId: string,
    updateOrderdto: UpdateOrderDto,
  ): Promise<void>;
  abstract getDepositHistory(
    historyParameters: HistoryParameters,
  ): Promise<DepositHistoryResponseDto>;
  abstract getPayoutHistory(
    historyParameters: HistoryParameters,
  ): Promise<PayoutHistoryResponseDto>;
  abstract deleteTdsRecord(orderId: string): Promise<void>;
  abstract getOrderById(transferId: string): Promise<PaymentEntity | undefined>;
  abstract getTaxDetails(userId: string): Promise<TdsDetailsResponse>;
  abstract getConversionRate(
    userId: string,
  ): Promise<ConversionRateResponseDto>;
  abstract generateInvoice(
    orderId: string,
    overwrite: boolean,
  ): Promise<string>;
  abstract checkIfPayoutAccountAlreadyValidated(
    request: CreatePayoutOrderRequestDto,
  ): Promise<{
    isAccountAlreadyValidated: boolean;
    isEverManuallyApproved: boolean;
    accountHolderName: string;
  }>;
  abstract savePayoutAccount(account: {
    userId: string;
    accountHolderName: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
  }): Promise<void>;
  abstract approvePayoutAccount(account: {
    userId: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
  }): Promise<void>;
  abstract getVerifiedWithdrawalAccounts(
    userId: string,
  ): Promise<VerifiedWithdrawalAccountDto[]>;
}

export const createMockPaymentRepository = (): PaymentRepository => ({
  createDepositOrder: jest.fn(),
  getOrder: jest.fn(),
  updateOrder: jest.fn(),
  getDailyPayoutCount: jest.fn(),
  createPayoutOrder: jest.fn(),
  getTotalDepositAmountInRange: jest.fn(),
  getTotalPayoutAmountInRange: jest.fn(),
  getTotalWithdrawalAmount: jest.fn(),
  getLastTdsRecord: jest.fn(),
  checkRefundExists: jest.fn(),
  updatePayoutOrder: jest.fn(),
  getDepositHistory: jest.fn(),
  getPayoutHistory: jest.fn(),
  deleteTdsRecord: jest.fn(),
  getOrderById: jest.fn(),
  getTaxDetails: jest.fn(),
  getConversionRate: jest.fn(),
  getVerifiedWithdrawalAccounts: jest.fn(),
  generateInvoice: jest.fn(),
  checkIfPayoutAccountAlreadyValidated: jest.fn(),
  savePayoutAccount: jest.fn(),
  approvePayoutAccount: jest.fn(),
});
