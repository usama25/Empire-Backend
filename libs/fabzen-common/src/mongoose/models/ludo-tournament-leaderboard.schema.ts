import { HydratedDocument, ObjectId, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type LudoTournamentLeaderboardDocument =
  HydratedDocument<LudoTournamentLeaderboard>;

@Schema({ timestamps: true })
export class LudoTournamentLeaderboard {
  @Prop({ required: true, type: Types.ObjectId })
  tournamentId: ObjectId;

  @Prop({ required: true, type: String })
  username: string;

  @Prop({ required: true, type: Types.ObjectId })
  userId: ObjectId;

  @Prop({ required: true, type: Number })
  roundNo!: number;

  @Prop({ required: true, type: Number })
  rank!: number;

  @Prop({ required: true, type: Number })
  score!: number;

  @Prop({ required: true, type: String })
  winAmount!: string;
}

export const LudoTournamentLeaderboardSchema = SchemaFactory.createForClass(
  LudoTournamentLeaderboard,
);

LudoTournamentLeaderboardSchema.index({
  roundNo: 1,
  tournamentId: 1,
  rank: 1,
});

LudoTournamentLeaderboardSchema.index({
  tournamentId: 1,
  userId: 1,
});
