import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class PlayRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  joinFee: string;
}
