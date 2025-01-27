import { IsNotEmpty, IsString } from 'class-validator';
import { Expose } from 'class-transformer';

export type TableID = string;
export type UserID = string;

export class JoinTableRequest {
  @Expose()
  @IsNotEmpty()
  @IsString()
  tableTypeId: string;
}

export class BatBowlRequest {
  @Expose()
  @IsNotEmpty()
  runs: number;

  @Expose()
  @IsNotEmpty()
  @IsString()
  tableId: string;

  // @Expose()
  // @IsNotEmpty()
  // @IsString()
  // role: string;
}

export class BowlRequest {
  @Expose()
  @IsNotEmpty()
  runs: number;
}

// export class ReadyToStartRequest {
//   @Expose()
//   @IsNotEmpty()
//   @IsString()
//   tableId: string;

//   @Expose()
//   @IsNotEmpty()
//   runs: number;
// }
