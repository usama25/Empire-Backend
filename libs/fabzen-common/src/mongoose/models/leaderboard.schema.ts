import { DWM, Games } from '@lib/fabzen-common/types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LeaderboardDocument = HydratedDocument<Leaderboard> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Leaderboard {
  @Prop()
  rank: number;

  @Prop()
  userId: string;

  @Prop()
  playedGames: number;

  @Prop()
  winAmount: string;

  @Prop()
  username: string;

  @Prop()
  avatar: number;

  @Prop()
  game: Games;

  @Prop()
  dwm: DWM;
}

export const LeaderboardSchema = SchemaFactory.createForClass(Leaderboard);

LeaderboardSchema.index({ game: 1, dwm: 1, userId: 1 });
LeaderboardSchema.index({ game: 1, dwm: 1, rank: 1 });
