import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { MobileNumber, Otp, Role } from '@lib/fabzen-common/types';
import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';

export type AuthDocument = HydratedDocument<Auth>;

@Schema({ _id: false, versionKey: false })
class OtpSchema {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  used: boolean;

  @Prop({ required: true })
  sentCount: number;

  @Prop({ required: true })
  lastSentAt: Date;

  @Prop({ required: true })
  failedAttempts: number;

  @Prop({ required: true })
  expiresAt: Date;
}

@Schema({ _id: false, versionKey: false })
export class BuildSchema {
  @Prop({ required: true })
  appCode: string;

  @Prop({ required: true })
  appVersion: string;

  @Prop({ required: true })
  isPlayStoreBuild: boolean;

  @Prop({ required: true })
  isGlobalBuild: boolean;

  @Prop()
  installSource: string;

  @Prop()
  installChannel: string;
}

@Schema({ timestamps: false, versionKey: false })
export class Auth {
  @Prop({ type: Array<string> })
  roles: Role[];

  @Prop({ type: Object, required: true })
  _id: MobileNumber;

  @Prop({ type: OtpSchema })
  otp: Otp;

  @Prop({ type: Types.ObjectId })
  userId: ObjectId;

  @Prop({ type: BuildSchema })
  build: BuildInfoDto;
}

export const AuthSchema = SchemaFactory.createForClass(Auth);
