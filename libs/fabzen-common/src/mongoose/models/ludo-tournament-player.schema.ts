import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { TournamentPlayerRoundInfo } from 'apps/ludo-tournament/src/ludo-tournament.types';

export type LudoTournamentPlayerDocument =
  HydratedDocument<LudoTournamentPlayer>;

@Schema({ timestamps: true })
export class LudoTournamentPlayer {
  @Prop({ required: true, type: Types.ObjectId })
  tournamentId: ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  userId: ObjectId;

  @Prop({ required: true, type: String })
  username: string;

  @Prop({ required: true, default: 0, type: Number })
  lostRoundNo: number;

  @Prop({ required: true, default: 0, type: Number })
  lastPlayedRoundNo: number;

  @Prop({ required: true, default: 0, type: Number })
  lastRoundScore: number;

  @Prop({ required: true, type: Array })
  rounds: TournamentPlayerRoundInfo[];
}

export const LudoTournamentPlayerSchema =
  SchemaFactory.createForClass(LudoTournamentPlayer);

LudoTournamentPlayerSchema.index({
  userId: 1,
  tournamentId: 1,
});
