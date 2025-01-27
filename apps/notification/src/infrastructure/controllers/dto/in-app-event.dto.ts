import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InAppEvent {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  eventName: string;

  @IsOptional()
  eventValue?: any;
}
