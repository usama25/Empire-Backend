import { IsOptional, IsString } from 'class-validator';

export type SPLiveGamesRequest = {
  userId?: string;
  tableId?: string;
  amount?: string;
  skip: number;
  count: number;
};

export class SPLiveGamesRequestDto {
  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  amount?: string;
}

export type SLLiveGamesRequest = {
  userId?: string;
  tableId?: string;
  amount?: string;
  skip: number;
  count: number;
};

export class SLLiveGamesRequestDto {
  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  amount?: string;
}

export type CBLiveGamesRequest = {
  userId?: string;
  tableId?: string;
  amount?: string;
  skip: number;
  count: number;
};

export class CBLiveGamesRequestDto {
  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  amount?: string;
}

export type RELiveGamesRequest = {
  userId?: string;
  tableId?: string;
  amount?: string;
  skip: number;
  count: number;
};

export class RELiveGamesRequestDto {
  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  amount?: string;
}
