import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';

export type PayoutAccountDocument = HydratedDocument<PayoutAccount> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class PayoutAccount {
  @Prop({ required: true, type: Types.ObjectId })
  userId!: ObjectId;

  @Prop({ required: true })
  accountHolderName!: string;

  @Prop({ required: true, default: false })
  approved!: boolean;

  @Prop()
  accountNumber?: string;

  @Prop()
  ifsc?: string;

  @Prop()
  upiId?: string;
}

export const PayoutAccountSchema = SchemaFactory.createForClass(PayoutAccount);

PayoutAccountSchema.index({ userId: 1 });
