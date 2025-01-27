import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import {
  Account,
  Gateway,
  PaymentMethod,
  PayoutType,
  TaxDeduction,
  TxnModes,
  TxnStatus,
} from '@lib/fabzen-common/types/payment.types';

export type PaymentDocument = HydratedDocument<Payment> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ _id: false })
export class AccountSchema {
  @Prop({ trim: true })
  accountNo!: string;

  @Prop()
  ifscCode!: string;
}

@Schema({ _id: false })
export class TaxDeductionSchema {
  @Prop({ required: true })
  transactionFrom!: Date;

  @Prop({ required: true })
  transactionTo!: Date;

  @Prop({ required: true })
  totalDepositAmount!: string;

  @Prop({ required: true })
  totalWithdrawalAmount!: string;

  @Prop({ required: true })
  withdrawalAmountAfterTaxDeduction!: string;

  @Prop({ required: true })
  netWithdrawalAmount!: string;

  @Prop({ required: true })
  totalTdsAmountDeducted!: string;

  @Prop({ required: true })
  isTdsDeducted!: boolean;

  @Prop({ required: true })
  financialYear!: string;
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, required: true })
  userId: ObjectId;

  @Prop({ required: true, unique: true })
  orderId: string;

  @Prop({ type: String, enum: TxnModes })
  mode: TxnModes;

  @Prop({ type: String, enum: Gateway })
  gateway: Gateway;

  @Prop({ required: true })
  amount: string;

  @Prop()
  settledAmount: string;

  @Prop()
  promoCode: string;

  @Prop({ type: AccountSchema })
  account?: Account;

  @Prop()
  upiId?: string;

  @Prop({ type: TaxDeductionSchema })
  taxdeduction?: TaxDeduction;

  @Prop()
  status: TxnStatus;

  @Prop({ type: String, enum: PayoutType })
  payoutType?: PayoutType;

  @Prop({ type: String, enum: PaymentMethod })
  paymentMethod?: PaymentMethod;

  @Prop()
  invoiceUrl?: string;

  @Prop()
  isPlayStoreBuild?: boolean;

  @Prop()
  accountVerificationCharges?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ userId: 1, createdAt: 1, status: 1, mode: 1 });

PaymentSchema.index({ createdAt: 1 });
