import { BonusType, WalletTypes } from '@lib/fabzen-common/types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CouponDocument = HydratedDocument<Coupon> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Coupon {
  @Prop()
  description!: string;

  @Prop({ default: 0 })
  minAmount!: string;

  @Prop()
  maxAmount!: string;

  @Prop()
  expireAt!: Date;

  @Prop({ default: 0 })
  bonusAmount!: string;

  @Prop({
    enum: BonusType,
    default: BonusType.rupees,
    type: String,
  })
  bonusType!: BonusType;

  @Prop({
    enum: WalletTypes,
    default: WalletTypes.bonusWallet,
    type: String,
  })
  wallet!: WalletTypes;

  @Prop({ required: true })
  promoCode!: string;

  @Prop({ default: false })
  isDeleted!: boolean;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
