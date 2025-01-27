import {
  Account,
  Gateway,
  PaymentMethod,
  PayoutType,
  TaxDeduction,
  TxnModes,
  TxnStatus,
} from '../types/payment.types';

export class PaymentEntity {
  constructor(
    public id: string,
    public userId: string,
    public orderId: string,
    public mode: TxnModes,
    public gateway: Gateway,
    public amount: string,
    public status: TxnStatus,
    public paymentMethod?: PaymentMethod,
    public settledAmount?: string,
    public taxdeduction?: TaxDeduction,
    public account?: Account,
    public upiId?: string,
    public payoutType?: PayoutType,
    public isPlayStoreBuild?: boolean,
    public accountVerificationCharges?: string,
  ) {}

  isFinalized(): boolean {
    return ![TxnStatus.pending, TxnStatus.manualReview].includes(this.status);
  }
}
