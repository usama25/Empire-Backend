import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  LudoMegaTournamentStatus,
  LudoMegaTournamentWinningPrize,
} from '@lib/fabzen-common/types';
import { PawnPosition } from 'apps/ludo-mega-tournament/src/domain/entities';

export type LudoMegaTournamentDocument =
  HydratedDocument<LudoMegaTournament> & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema()
export class LudoMegaTournament {
  // Common properties From Tournament Schema
  game: string;
  name: string;
  alias: string;
  joinFee: string;
  isRepeatable: boolean;

  @Prop({
    type: String,
    required: true,
    enum: LudoMegaTournamentStatus,
    default: LudoMegaTournamentStatus.live,
  })
  status: LudoMegaTournamentStatus;

  @Prop({ required: true, type: Date })
  endAt: Date;

  @Prop({ required: true })
  winningPrizes!: LudoMegaTournamentWinningPrize[];

  @Prop({ required: true, type: Number })
  maxTotalEntries!: number;

  @Prop({ required: true, type: Number })
  maxEntriesPerUser!: number;

  @Prop({ required: true, type: Number, default: 0 })
  enteredUserCount!: number;

  @Prop({ required: true, type: Number, default: 0 })
  highestScore: number;

  // End time extension step in seconds
  @Prop({ required: true, type: Number })
  extensionTime!: number;

  @Prop({ required: true, type: Number })
  maxExtensionLimit!: number;

  @Prop({ required: true, type: Number, default: 0 })
  extendedCount!: number;

  @Prop({ type: String })
  totalWinAmount: string;

  @Prop({ type: Boolean, default: false })
  useSamePawnPositions: boolean;

  @Prop({ type: Array, default: [] })
  pawnPositions: PawnPosition[];

  @Prop({ required: true, type: Number, default: 0 })
  totalMoves: number;
}

export const LudoMegaTournamentSchema =
  SchemaFactory.createForClass(LudoMegaTournament);

LudoMegaTournamentSchema.index({
  status: 1,
  _id: 1,
  joinFee: 1,
  winningPrizes: 1,
  createdAt: 1,
});
