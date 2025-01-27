import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Games } from '@lib/fabzen-common/types';

export type TournamentPlayerDocument = HydratedDocument<TournamentPlayer>;

@Schema({ discriminatorKey: 'game' })
export class TournamentPlayer {
  @Prop({
    type: String,
    required: true,
    enum: Games,
  })
  game: string;

  @Prop({ required: true, type: Types.ObjectId })
  tournamentId: ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  userId: ObjectId;

  @Prop({ type: String })
  username: string;

  @Prop({ type: Number })
  avatar: number;
}

export const TournamentPlayerSchema =
  SchemaFactory.createForClass(TournamentPlayer);
