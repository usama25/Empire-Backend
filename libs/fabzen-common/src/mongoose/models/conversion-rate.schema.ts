import { Country } from '@lib/fabzen-common/types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversionRateDocument = HydratedDocument<ConversionRate> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class ConversionRate {
  @Prop({ required: true, unique: true })
  country: Country;

  @Prop({ required: true })
  conversionRate: number;

  @Prop({ required: true })
  currencyCode: string;

  @Prop({ required: true })
  currencySymbol: string;
}

export const ConversionRateSchema =
  SchemaFactory.createForClass(ConversionRate);
