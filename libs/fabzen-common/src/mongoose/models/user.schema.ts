import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  MobileNumber,
  Role,
  Address,
  Device,
  ExternalIds,
  Kyc,
  Wallet,
  Stats,
  Referral,
} from '@lib/fabzen-common/types';
import {
  getRandomInteger,
  getRandomString,
} from '@lib/fabzen-common/utils/random.utils';
import { config } from '@lib/fabzen-common/configuration';
import {
  BuildInfoDto,
  DeviceDto,
} from '@lib/fabzen-common/dtos/user.common.dto';

import { BuildSchema } from './auth.schema';

export type UserDocument = HydratedDocument<User>;
export type CounterDocument = HydratedDocument<Counter>;

@Schema({ _id: false })
export class ReferralSchema {
  @Prop({
    type: String,
    unique: true,
    default: () => getRandomString(8, config.user.referralCodeAlphabet),
  })
  code: string;

  @Prop({ type: Types.ObjectId, required: false })
  user: ObjectId;

  @Prop({ type: Number, default: 0 })
  count: number;

  @Prop({ type: Number, default: 0 })
  earning: number;

  @Prop({ type: Boolean, default: true })
  canBeReferred: boolean;
}

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ type: String, required: false })
  name?: string;

  @Prop({ type: String, required: true, unique: true })
  username: string;

  @Prop({ type: String, required: false })
  email: string;

  @Prop({ type: String })
  ipAddress: string;

  @Prop({ type: Array<string>, default: [Role.player] })
  roles: Role[];

  @Prop({ type: Object, required: true, unique: true })
  mobileNumber: MobileNumber;

  @Prop({ type: Object, required: false })
  address: Address;

  @Prop({ type: Object, required: false })
  stats: Stats;

  @Prop({ type: Object, required: false })
  device: Device;

  @Prop({ type: Object, required: false })
  deviceInfo: DeviceDto;

  @Prop({ default: () => getRandomInteger(0, config.user.maxAvatarIndex) })
  avatar: number;

  @Prop({ type: Object, required: false })
  externalIds: ExternalIds;

  @Prop({ type: ReferralSchema, default: () => new ReferralSchema() })
  referral: Referral;

  @Prop({ type: Boolean, default: false })
  isBlocked: boolean;

  @Prop({ type: Object, required: false })
  kyc: Kyc;

  @Prop({ type: Boolean, default: false })
  isEmailVerified: boolean;

  @Prop({ type: Boolean, default: false })
  isProActive: boolean;

  @Prop({ type: Object, default: { main: '0', win: '0', bonus: '0' } })
  wallet: Wallet;

  @Prop({ type: BuildSchema })
  build: BuildInfoDto;

  @Prop({ type: Number, default: 0 })
  playedFreeGames: number;

  @Prop({ type: Date })
  freeGamesUpdatedAt?: Date;
}

@Schema({ timestamps: true })
export class Counter {
  @Prop({ type: Number, required: true })
  numericId!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
export const CounterSchema = SchemaFactory.createForClass(Counter);

UserSchema.index({
  updatedAt: 1,
});
UserSchema.index({ 'kyc.data.cardNumber': 1, 'kyc.data.cardType': 1 });
UserSchema.index({ 'mobileNumber.number': 1 });
UserSchema.index({ createdAt: 1 });
