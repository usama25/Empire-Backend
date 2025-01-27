import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';

import { Games, GameOutcome, TableType } from '@lib/fabzen-common/types';
import { GameTypes } from 'apps/ludo-gameplay/src/ludo-gameplay.types';
import { ReTableType } from 'apps/re-gameplay/src/re-gameplay.types';

export type GameHistoryDocument = HydratedDocument<GameHistory> & {
  createdAt: Date;
  updatedAt: Date;
};

// SP Table Type
@Schema()
class TableTypeSchema {
  @Prop({ required: true })
  tableTypeId!: string;

  @Prop({ required: true })
  minJoinAmount!: string;

  @Prop({ required: true })
  initialBetAmount!: string;

  @Prop({ required: true })
  potLimit!: string;

  @Prop({ required: true })
  gameType!: string;
}

// RE Table Type
@Schema()
class ReTableTypeSchema {
  @Prop({ required: true })
  tableTypeId!: string;

  @Prop({ required: true })
  variation!: string;

  @Prop({ required: true })
  pointValue!: string;

  @Prop({ required: true })
  maxPlayer!: string;

  @Prop({ required: true })
  matchingTime!: string;
}

// CB Player Type
@Schema({ _id: false })
export class CbrPlayerSchema {
  @Prop({ type: String, required: true })
  winLoseAmount: string;

  @Prop({ type: String, required: true })
  outcome: GameOutcome;

  @Prop({ type: Boolean })
  active: boolean;

  @Prop({ type: String })
  playerId: string;

  @Prop({ type: String })
  username: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: Number })
  avatar: number;

  @Prop({ type: String })
  totalScore: string;

  @Prop({ type: Array<string> })
  scores: string[];
}

@Schema({ timestamps: true })
export class GameHistory {
  @Prop({ type: Types.ObjectId, required: true })
  userId: ObjectId;

  @Prop({ type: String, required: true })
  game: Games;

  @Prop({ type: String })
  tableId: string;

  @Prop({ type: Types.ObjectId })
  tournamentId: ObjectId;

  @Prop({ type: String })
  joinFee: string;

  @Prop({ type: Date })
  startedAt: Date;

  // RE Specific
  @Prop({ type: ReTableTypeSchema })
  tableReType: ReTableType;

  // SP Specific
  @Prop({ type: TableTypeSchema })
  tableType: TableType;

  // SP Specific
  @Prop({ type: String })
  startAmount: string;

  // SP Specific
  @Prop({ type: String })
  endAmount: string;

  // SP Specific
  @Prop({ type: Number })
  roundNo: number;

  // Ludo Specific
  @Prop({ type: String, enum: GameTypes })
  gameType: GameTypes;

  @Prop({ type: Number })
  roomSize: number;

  /** CB Specific */
  @Prop({ type: Number })
  totalRounds: number;

  @Prop({ type: Number })
  winLoseAmount: number;

  @Prop({ type: String })
  outcome: GameOutcome;

  @Prop({ type: Boolean })
  active: boolean;

  @Prop({ type: String })
  playerId: string;

  @Prop({ type: String })
  username: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: Number })
  avatar: number;

  @Prop({ type: String })
  totalScore: string;

  @Prop({ type: Array<string> })
  scores: string[];
  //**End Of CB Specific */
}

export const GameHistorySchema = SchemaFactory.createForClass(GameHistory);

GameHistorySchema.index({ userId: 1, game: 1, tableId: 1 });
GameHistorySchema.index({ createdAt: 1, game: 1 });
GameHistorySchema.index({ game: 1, tableId: 1, createdAt: 1 });
GameHistorySchema.index({ userId: 1, joinFee: 1 });
