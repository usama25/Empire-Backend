import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';

export type CouponUserDocument = HydratedDocument<CouponUser> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class CouponUser {
  @Prop({ required: true, type: Types.ObjectId })
  couponId: ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  userId: ObjectId;

  @Prop({ required: true })
  orderId: string;
}

export const CouponUserSchema = SchemaFactory.createForClass(CouponUser);
