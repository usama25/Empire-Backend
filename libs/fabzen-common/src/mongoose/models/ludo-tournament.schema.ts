import { HydratedDocument } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  TournamentStatus,
  WinningPrize,
} from 'apps/ludo-tournament/src/ludo-tournament.types';

export type LudoTournamentDocument = HydratedDocument<LudoTournament> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class LudoTournament {
  @Prop({ required: true })
  name!: string;

  @Prop()
  alias!: string;

  @Prop({ required: true, type: Number, min: 2, max: 4 })
  noPlayersPerGame!: number;

  @Prop({ required: true })
  joinFee!: string;

  @Prop({
    required: true,
    enum: TournamentStatus,
    default: TournamentStatus.created,
    type: String,
  })
  status!: TournamentStatus;

  @Prop({ required: true, type: Date })
  startAt!: Date;

  @Prop({ required: true, type: Date })
  endAt!: Date;

  @Prop({ required: true })
  registerTill!: Date;

  @Prop({ required: true, type: Number, min: 2 })
  maxNoPlayers!: number;

  @Prop({ required: true, type: Number, min: 2 })
  minNoPlayers!: number;

  @Prop({ required: true, type: Boolean })
  isRepeatable!: boolean;

  @Prop({ type: Boolean })
  isAutomatic?: boolean;

  @Prop({ required: true })
  winningPrizes!: WinningPrize[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ type: Date })
  activatedAt!: Date;

  @Prop({ type: Date })
  filledAt!: Date;

  @Prop({ type: Number, default: 0 })
  currentRoundNo!: number;

  @Prop({ type: Number, default: 1 })
  totalRounds!: number;

  @Prop({ default: false })
  featured!: boolean;

  @Prop()
  dynamicLink!: string;
}

export const LudoTournamentSchema =
  SchemaFactory.createForClass(LudoTournament);
