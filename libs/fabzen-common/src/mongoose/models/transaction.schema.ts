import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Games, Wallet } from '@lib/fabzen-common/types';
import { TransactionType } from '@lib/fabzen-common/types/transaction.types';

export type TransactionDocument = HydratedDocument<Transaction>;

export class BreakDown {
  @Prop()
  main!: string;

  @Prop()
  winning!: string;

  @Prop()
  bonus!: string;
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, required: true })
  userId: ObjectId;

  @Prop()
  orderId?: string;

  @Prop({ required: true })
  amount: string;

  @Prop()
  game?: Games;

  @Prop()
  tableId?: string;

  @Prop({ type: Types.ObjectId })
  tournamentId?: ObjectId;

  @Prop({ type: Number })
  entryNo?: number;

  @Prop({ type: Types.ObjectId })
  referredUserId?: ObjectId;

  @Prop({ type: String })
  referredUserName?: string;

  @Prop({ type: String, enum: TransactionType })
  type: TransactionType;

  @Prop({ type: BreakDown })
  breakDown: Wallet;

  @Prop()
  expireAt?: Date;

  @Prop()
  expired?: boolean;

  @Prop({ type: String })
  refundBy?: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index({
  userId: 1,
  orderId: 1,
  type: 1,
  tableId: 1,
  referredUserId: 1,
});

TransactionSchema.index({
  userId: 1,
  expired: 1,
});

TransactionSchema.index({
  userId: 1,
  type: 1,
});

TransactionSchema.index({ createdAt: 1 });

TransactionSchema.index({ tournamentId: 1 });
