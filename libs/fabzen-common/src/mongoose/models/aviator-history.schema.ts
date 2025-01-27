import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AviatorRoundHistoryDocument =
  HydratedDocument<AviatorRoundHistory> & {
    createdAt: Date;
    updatedAt: Date;
  };

export type PlayerSeedProfile = {
  userId: string;
  username: string;
  avatar: number;
  playerSeed: string;
};

@Schema()
class PlayerProfileSchema {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  username!: string;

  @Prop({ required: true })
  avatar!: number;

  @Prop({ required: true })
  playerSeed!: string;
}

@Schema({ timestamps: true })
export class AviatorRoundHistory {
  @Prop({ type: Number, required: true, unique: true })
  roundNo!: number;
  @Prop({ type: Number, required: true })
  crashValue!: number;
  @Prop({ type: String, required: true })
  serverSeed!: string;
  @Prop({ type: [PlayerProfileSchema], required: true })
  players!: PlayerSeedProfile[];
  @Prop({ type: Number })
  profit!: number;
}

export const AviatorRoundHistorySchema =
  SchemaFactory.createForClass(AviatorRoundHistory);
