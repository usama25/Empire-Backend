import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';
import {
  ReTableType,
  ReUserInfo,
} from 'apps/re-gameplay/src/re-gameplay.types';

export type ReRoundHistoryDocument = HydratedDocument<ReRoundHistory> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema()
class TableTypeSchema {
  @Prop({ required: true })
  tableTypeId: string;

  @Prop({ required: true })
  variation!: string;

  @Prop({ required: true })
  pointValue!: string;

  @Prop({ required: true })
  maxPlayer!: string;

  @Prop({ required: true })
  matchingTime!: number;
}

@Schema()
class UserInfoSchema {
  @Prop({ type: Types.ObjectId, required: true })
  userId!: ObjectId;
  @Prop({ type: String, required: true })
  username!: string;
  @Prop({ type: String, required: true })
  outcome!: string;
  @Prop({ type: String, required: true })
  avatar!: string;
  @Prop({ type: String, required: true })
  winLossAmount!: string;
}

@Schema({ timestamps: true })
export class ReRoundHistory {
  @Prop({ type: String, required: true })
  tableId!: string;
  @Prop({ type: TableTypeSchema, required: true })
  tableType!: ReTableType;
  @Prop({ type: String, required: true })
  joinFee!: string;
  @Prop({ type: String, required: true })
  roundId!: string;
  @Prop({ type: String, required: true })
  commissionAmount!: string;
  @Prop({ type: String, required: true })
  winner!: string;
  @Prop({ type: String, required: true })
  wildCard!: string;
  @Prop({ type: Array<UserInfoSchema>, required: true })
  userInfo!: ReUserInfo[];
  @Prop({ type: String, required: false })
  roundStartedAt?: string;
}

export const ReRoundHistorySchema =
  SchemaFactory.createForClass(ReRoundHistory);

ReRoundHistorySchema.index({ tableId: 1, 'userInfo.userId': 1 });
ReRoundHistorySchema.index({ createdAt: 1 });
