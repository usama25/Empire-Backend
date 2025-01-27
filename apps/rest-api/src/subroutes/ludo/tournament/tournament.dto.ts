import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { WinningPrize } from 'apps/ludo-gameplay/src/ludo-gameplay.types';

export class UpdateTournamentDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    default: 'Ludo Tournament',
  })
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    default: 'Greatest of All',
  })
  alias?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(2)
  @Max(4)
  noPlayersPerGame: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 1024,
  })
  maxNoPlayers: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 2,
  })
  minNoPlayers: number;

  @IsNotEmpty()
  @IsBoolean()
  isRepeatable: boolean;

  @IsNotEmpty()
  @IsBoolean()
  isAutomatic: boolean;

  @IsNotEmpty()
  @IsArray()
  @ApiProperty({
    default: [
      {
        minRank: 1,
        maxRank: 1,
        amount: '200',
        percentage: 20,
      },
    ],
  })
  winningPrizes: WinningPrize[];

  @IsNotEmpty()
  @IsBoolean()
  featured: boolean;

  @IsNotEmpty()
  @IsBoolean()
  withCustomSound: boolean;
}

export class CreateTournamentDto extends UpdateTournamentDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    default: '1',
  })
  joinFee: string;

  @IsNotEmpty()
  @IsDateString()
  startAt: Date;
}
