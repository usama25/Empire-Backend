import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type LudoMegaTournamentPlayerDocument =
  HydratedDocument<LudoMegaTournamentPlayer> & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema()
export class LudoMegaTournamentPlayer {
  // Common properties From Tournament Schema
  game: string;
  tournamentId: string;
  userId: string;
  username: string;
  avatar: number;

  @Prop({ type: String, required: true })
  tournamentName: string;

  @Prop({ type: String, required: true })
  joinFee: string;

  @Prop({ type: String, required: true })
  tableId: string;

  @Prop({ type: Number, required: true })
  score: number;

  @Prop({ type: Number, required: true })
  entryNo: number;

  @Prop({ type: Number, required: true, default: 0 })
  rank: number;

  @Prop({ type: String, required: true, default: '0' })
  winAmount: string;

  @Prop({ type: Number, required: true })
  totalPlayed: number;

  @Prop({ type: String })
  state?: string;

  @Prop({ type: Date })
  endAt?: Date;
}

export const LudoMegaTournamentPlayerSchema = SchemaFactory.createForClass(
  LudoMegaTournamentPlayer,
);

LudoMegaTournamentPlayerSchema.index({
  tournamentId: 1,
  userId: 1,
  score: 1,
});

LudoMegaTournamentPlayerSchema.index({
  tournamentId: 1,
  winAmount: 1,
});

LudoMegaTournamentPlayerSchema.index({
  tournamentId: 1,
  score: 1,
});

LudoMegaTournamentPlayerSchema.index({
  tableId: 1,
});

LudoMegaTournamentPlayerSchema.index({
  userId: 1,
  _id: 1,
});
