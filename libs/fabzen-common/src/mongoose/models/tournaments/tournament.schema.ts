import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Games, LudoMegaTournamentStatus } from '@lib/fabzen-common/types';

export type TournamentDocument = HydratedDocument<Tournament> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true, discriminatorKey: 'game' })
export class Tournament {
  @Prop({
    type: String,
    required: true,
    enum: Games,
  })
  game: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  alias: string;

  @Prop({ type: String, required: true })
  joinFee: string;

  @Prop({ type: String, required: true, enum: LudoMegaTournamentStatus })
  status: LudoMegaTournamentStatus;

  @Prop({ type: Boolean, required: true, default: false })
  isRepeatable: boolean;
}

export const TournamentSchema = SchemaFactory.createForClass(Tournament);
