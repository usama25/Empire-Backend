import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';
import {
  TableType,
  Card,
  CardsCategory,
  PlayerCardsInfo,
  UserInfo,
} from '@lib/fabzen-common/types';

export type SpRoundHistoryDocument = HydratedDocument<SpRoundHistory> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema()
class TableTypeSchema {
  @Prop({ required: true })
  minJoinAmount!: string;

  @Prop({ required: true })
  initialBetAmount!: string;

  @Prop({ required: true })
  potLimit!: string;

  @Prop({ required: true })
  gameType!: string;
}

@Schema()
class PlayerCardsInfoSchema {
  @Prop({ type: CardsCategory, required: true })
  category!: CardsCategory;
  @Prop({ type: [String], required: true })
  cards!: [Card, Card, Card];
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
  winLossAmount!: string;
  @Prop({ type: String, required: true })
  betAmount!: string;
  @Prop({ type: String, required: true })
  status!: string;
  @Prop({ type: String, required: true })
  playerAmount!: string;
  @Prop({ type: PlayerCardsInfoSchema, required: false })
  playerCardsInfo?: PlayerCardsInfo;
  @Prop({ type: Array<string>, required: false })
  handCards?: [Card, Card, Card];
}

@Schema({ timestamps: true })
export class SpRoundHistory {
  @Prop({ type: String, required: true })
  tableId!: string;
  @Prop({ type: TableTypeSchema, required: true })
  tableType!: TableType;
  @Prop({ type: Number, required: true })
  roundNo!: number;
  @Prop({ type: String, required: true })
  potAmount!: string;
  @Prop({ type: String, required: false })
  commissionAmount?: string;
  @Prop({ type: String, required: false })
  tableCard?: Card;
  @Prop({ type: Array<string>, required: true })
  winners!: [string];
  @Prop({ type: Array<UserInfoSchema>, required: true })
  userInfo!: UserInfo[];
  @Prop({ type: String, required: false })
  roundStartedAt?: string;
}

export const SpRoundHistorySchema =
  SchemaFactory.createForClass(SpRoundHistory);

SpRoundHistorySchema.index({ tableId: 1, 'userInfo.userId': 1 });
SpRoundHistorySchema.index({ createdAt: 1 });
