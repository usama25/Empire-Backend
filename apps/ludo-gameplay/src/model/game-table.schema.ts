import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { GameStatus, GameTypes, Player } from '../ludo-gameplay.types';

export type GameTableDocument = HydratedDocument<GameTable> & {
  createdAt: Date;
  updatedAt: Date;
};

export type LudoGameTableDocument = HydratedDocument<GameTable> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class GameTable {
  @Prop({ required: true, unique: true })
  tableId!: string;

  @Prop({ type: String, enum: GameTypes })
  gameType!: string;

  @Prop({ type: String })
  tableTypeId: string;

  @Prop()
  tournamentId!: string;

  @Prop()
  roundNo!: number;

  @Prop({ required: true })
  players!: Player[];

  @Prop({ required: true })
  winner!: string;

  @Prop()
  joinFee!: string; // amount expressed as a string, eg.: "10.5"

  @Prop()
  winAmount!: string; // amount expressed as a string, eg.: "18.9"

  @Prop({ type: String, enum: GameStatus, default: GameStatus.started })
  status!: GameStatus;

  @Prop({ type: Object })
  scores!: any;
}

export const GameTableSchema = SchemaFactory.createForClass(GameTable);

GameTableSchema.index({
  status: 1,
  createdAt: 1,
});

GameTableSchema.index({
  'players.userId': 1,
  status: 1,
  tournamentId: 1,
  roundNo: 1,
});

GameTableSchema.index({
  'players.userId': 1,
  updatedAt: 1,
  status: 1,
});

GameTableSchema.index({
  tournamentId: 1,
  roundNo: 1,
});

GameTableSchema.index({
  createdAt: 1,
});
