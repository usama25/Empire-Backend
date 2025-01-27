import * as dayjs from 'dayjs';
import { ObjectId } from 'mongoose';
import { MobileNumber } from './';
import { UserEntity } from '../entities';

export enum TxnStatus {
  pending = 'pending',
  expired = 'expired',
  failed = 'failed',
  refund = 'refund',
  cancelled = 'cancelled',
  flagged = 'flagged',
  success = 'success',
  manualReview = 'manualReview',
}

export enum TxnModes {
  refund = 'refund',
  deposit = 'deposit',
  withdrawal = 'withdrawal',
  convert = 'convert',
}

export enum Gateway {
  juspay = 'Juspay',
  cashfree = 'Cashfree',
  internal = 'Internal',
}

export enum Currency {
  INR = 'INR',
}

export enum PayoutType {
  UPI = 'UPI',
  IMPS = 'IMPS',
  UPI_ID = 'UPI_ID',
  ACCOUNT_IFSC = 'ACCOUNT_IFSC',
}

export type Account = {
  accountNo?: string;
  ifscCode?: string;
};

export type Beneficiary = {
  beneficiaryId: ObjectId;
  payoutType: PayoutType;
  upiId?: string;
  account?: Account;
};

export type TaxDeduction = {
  transactionFrom: Date;
  transactionTo: Date;
  totalDepositAmount: string;
  totalWithdrawalAmount: string;
  withdrawalAmountAfterTaxDeduction: string;
  netWithdrawalAmount: string;
  totalTdsAmountDeducted: string;
  isTdsDeducted: boolean;
  financialYear: string;
};

export type CashfreeCreateDepositRequest = {
  order_id: string;
  order_amount: number;
  order_currency: Currency;
  order_note: string;
  customer_details: {
    customer_id: string;
    customer_name: string;
    customer_email?: string;
    customer_phone: string;
  };
  order_meta: {
    return_url: string;
    notify_url: string;
  };
};

export type CashfreeCreateOrderApiResponse = {
  entity: string;
  order_amount: number;
  order_expiry_time: string;
  order_id: string;
  order_status: string;
  payment_session_id: string;
  payments: {
    url: string;
  };
  order_meta: orderMeta;
  code?: string;
  type?: string;
};

type orderMeta = {
  return_url: string;
  notify_url: string;
  payment_methods: string;
};

export type CashfreeSessionResponse = {
  action: string;
  cf_payment_id: number;
  channel: string;
  data: {
    payload: {
      default: string;
      gpay: string;
      paytm: string;
      phonepe: string;
      web: string;
    };
    content_type: null;
    method: null;
  };
  payment_amount: number;
  payment_method: string;
};

export type SaveDepositOrderDto = {
  userId: string;
  amount: string;
  orderId: string;
  gateway: Gateway;
  paymentMethod: PaymentMethod;
};

export interface CashfreeOrderStatusApiResponse {
  order_id: string;
  order_status: CashfreeOrderStatus;
  order_amount: number;
  order_currency: Currency;
  payment_session_id: string;
  order_meta: orderMeta;
}

export enum CashfreePaymentMethod {
  card = 'card',
  netbanking = 'netbanking',
  wallet = 'wallet',
  upi = 'upi',
  banktransfer = 'banktransfer',
}

export enum CashfreePaymentStatus {
  success = 'SUCCESS',
  notAttempted = 'NOT_ATTEMPTED',
  failed = 'FAILED',
  userDropped = 'USER_DROPPED',
  cancelled = 'CANCELLED',
  pending = 'PENDING',
}

export type CashfreePaymentDetails = {
  payment_status: CashfreePaymentStatus;
  payment_method: Record<CashfreePaymentMethod, any>;
};

export enum CashfreeOrderStatus {
  ACTIVE = 'ACTIVE',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  PENDING = 'PENDING',
  REVERSED = 'REVERSED',
  FAILURE = 'FAILURE',
  FAILED = 'FAILED',
}

export type UpdateOrderDto = {
  status: TxnStatus;
  settledAmount?: string;
  paymentMethod?: string;
};

export type ValidateIMPS = {
  name: string;
  mobileNumber?: string;
  ifsc?: string;
  bankAccount?: string;
};

export type SavePayoutOrderDto = {
  userId: string;
  amount: string;
  orderId: string;
  gateway?: Gateway;
  mode: TxnModes;
  account?: Account;
  upiId?: string;
  payoutType?: PayoutType;
  taxdeduction?: TaxDeduction;
  settledAmount?: string;
  status?: TxnStatus;
  isPlayStoreBuild?: boolean;
  accountVerificationCharges?: string;
};

export type beneficiaryRequest = {
  beneId: string;
  name?: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  bankAccount?: string;
  ifsc?: string;
  vpa?: string;
};

export type FinancialYearDates = {
  yearStart: Date;
  yearEnd: Date;
};

export type TransferRequest = {
  user: UserEntity;
  amount: string;
  transferId: string;
  payoutType: PayoutType;
  orderId: string;
  account?: Account;
  upiId?: string;
};

export type JuspayCreateOrderApiResponse = {
  status: JuspayOrderStatus;
  error_code?: string;
  error_message?: string;
  id: string; // unused
  order_id: string;
  payment_links: JuspayPaymentLinks;
  sdk_payload: JuspayCreateOrderSdkPayload;
};

export type JuspayCreateOrderSdkPayload = {
  requestId: string;
  service: string;
  payload: {
    clientId: string;
    amount: string;
    merchantId: string;
    clientAuthToken: string;
    clientAuthTokenExpiry: string;
    environment: string;
    action: 'paymentPage';
    customerId: string;
    returnurl: string;
    currency: Currency;
    customerPhone: string;
    customerEmail: string;
    orderId: string;
    description: string;
  };
};

// https://developer.juspay.in/v2.0/docs/transaction-status-codes
export enum JuspayOrderStatus {
  NEW = 'NEW',
  PENDING_VBV = 'PENDING_VBV',
  VBV_SUCCESSFUL = 'VBV_SUCCESSFUL',
  CHARGED = 'CHARGED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  JUSPAY_DECLINED = 'JUSPAY_DECLINED',
  AUTHORIZING = 'AUTHORIZING',
  COD_INITIATED = 'COD_INITIATED',
  STARTED = 'STARTED',
  AUTO_REFUNDED = 'AUTO_REFUNDED',
  CAPTURE_INITIATED = 'CAPTURE_INITIATED',
  CAPTURE_FAILED = 'CAPTURE_FAILED',
  VOID_INITIATED = 'VOID_INITIATED',
  VOIDED = 'VOIDED',
  VOID_FAILED = 'VOID_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  PARTIAL_CHARGED = 'PARTIAL_CHARGED',
  error = 'error',
  ERROR = 'ERROR',
}

export type JuspayPaymentLinks = {
  expiry?: string | null;
  web?: string;
};

export type JuspayCreateDepositRequest = {
  order_id: string;
  amount: string;
  customer_id: string;
  customer_email: string;
  customer_phone: string;
  payment_page_client_id: string;
  action: string;
  returnUrl: string;
  description: string;
  'metadata.webhook_url': string;
};

export type JuspaySessionResponse = {
  order_id: string;
  status: string;
  payment: {
    sdk_params: {
      tid: string;
      amount: string;
      customer_last_name: string;
      customer_first_name: string;
      currency: string;
      merchant_vpa: string;
      merchant_name: string;
      mcc: string;
      tr: string;
    };
    authentication: {
      url: string;
      method: string;
    };
  };
  txn_uuid: string;
  txn_id: string;
};

export type JuspayApiStatusResponse = {
  order_id: string;
  customer_email: string;
  customer_phone: string;
  customer_id: string;
  status: JuspayOrderStatus;
  amount: number;
  currency: Currency;
  date_created: string;
  payment_links: JuspayPaymentLinks;
  refunded: boolean;
  amount_refunded: number;
  effective_amount: number;
  payment_method_type: string;
};

export type JuspayCreatePayoutRequest = {
  orderId?: string;
  fulfillments: fulfillments[];
  amount: number;
  customerId: string;
  customerPhone: string;
  customerEmail: string;
  type: string;
};

type fulfillments = {
  amount: number;
  beneficiaryDetails: beneficiaryDetails;
  preferredMethodList: string[];
  additionalInfo: {
    webhookDetails: {
      url: string;
    };
  };
};

export type beneficiaryDetails = {
  type: PayoutType;
  details: {
    name: string;
    account?: string;
    ifsc?: string;
    vpa?: string;
  };
};

export interface JuspayPayoutCreateOrderResponse {
  type: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  orderId: string;
  customerId: string;
  amount: number;
}

export type JuspayPayoutStatusResponse = {
  type: string;
  status: JuspayPayoutStatus;
  errorCode?: string;
  errorMessage?: string;
  orderId: string;
  customerId: string;
  amount: number;
};

export enum JuspayPayoutStatus {
  FULFILLMENTS_SCHEDULED = 'FULFILLMENTS_SCHEDULED',
  FULFILLMENTS_FAILURE = 'FULFILLMENTS_FAILURE',
  FULFILLMENTS_SUCCESSFUL = 'FULFILLMENTS_SUCCESSFUL',
  FULFILLMENTS_CANCELLED = 'FULFILLMENTS_CANCELLED',
  FULFILLMENTS_MANUAL_REVIEW = 'FULFILLMENTS_MANUAL_REVIEW',
  READY_FOR_FULFILLMENT = 'READY_FOR_FULFILLMENT',
}

export type WebhookRequest = {
  orderId: string;
};

export enum PaymentMethod {
  upi = 'UPI',
  netbanking = 'NetBanking',
  card = 'Card',
}

export type InvoiceInfo = {
  username: string;
  mobileNumber: MobileNumber;
  email: string;
  state: string;
  transactionRefNo: string;
  billNo: string;
  date: dayjs.Dayjs;
  amount: string;
  settledAmount: string;
};
