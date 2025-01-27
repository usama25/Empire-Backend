import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Expose, Type } from 'class-transformer';

import { testObjectId } from '@lib/fabzen-common/jest/stubs';
import {
  LudoMegaTournamentStatus,
  Meta,
  LudoMegaTournamentWinningPrize,
} from '@lib/fabzen-common/types';

export class UpdateMegaTournamentDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    default: 'Ludo Tournament',
  })
  name: string;

  @Expose()
  @IsOptional()
  @IsString()
  @ApiProperty({
    default: 'Greatest of All',
  })
  alias: string;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 1000,
  })
  maxTotalEntries: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 10,
  })
  maxEntriesPerUser: number;

  @Expose()
  @IsNotEmpty()
  @IsArray()
  @ApiProperty({
    default: [
      {
        minRank: 1,
        maxRank: 1,
        percentage: 20,
      },
    ],
  })
  winningPrizes: LudoMegaTournamentWinningPrize[];

  @Expose()
  @IsNotEmpty()
  @IsDateString()
  endAt: Date;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 60 * 30, // 30 minutes
  })
  extensionTime: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 3,
  })
  maxExtensionLimit: number;

  @Expose()
  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({
    default: true,
  })
  isRepeatable: boolean;

  @Expose()
  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    default: true,
  })
  useSamePawnPositions: boolean;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 36,
  })
  totalMoves: number;
}

export class CreateLudoMegaTournamentDto extends UpdateMegaTournamentDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    default: '1',
  })
  joinFee: string;
}

export class LudoMegaTournamentDto extends CreateLudoMegaTournamentDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    default: testObjectId,
  })
  id: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    default: 'emp://ludoMegaTournament/tournamentId=<tournamentId>',
  })
  deepLink: string;

  @Expose()
  @IsNotEmpty()
  @IsDateString()
  createdAt: Date;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 36,
  })
  totalMoves: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 3,
  })
  enteredUserCount: number;

  @Expose()
  @IsNotEmpty()
  @IsNumberString()
  @ApiProperty({
    default: '100',
  })
  totalPrizePool: string;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 3,
  })
  totalWinners: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 3,
  })
  myEntryCount: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 3,
  })
  myHighestScore: number;

  @Expose()
  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 3,
  })
  highestScore: number;
}

export class LeaderboardEntryDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    default: 'username',
  })
  username: string;

  @IsNotEmpty()
  @IsNumber()
  avatar: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 1,
  })
  rank: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 10,
  })
  totalPlayed: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 10,
  })
  score: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({
    default: 3,
  })
  entryNo: number;

  @IsOptional()
  @IsNumberString()
  @ApiProperty({
    default: '12.34',
  })
  winAmount: string;
}

export class LeaderboardDto {
  @Expose()
  @IsNotEmpty()
  @IsArray()
  @ApiProperty({
    default: [
      {
        username: 'Username',
        rank: 1,
        score: 12,
        entryNumber: 3,
        winning: '10000',
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => LeaderboardEntryDto)
  items: LeaderboardEntryDto[];

  @Expose()
  @IsNotEmpty()
  @IsEnum(LudoMegaTournamentStatus)
  status: LudoMegaTournamentStatus;

  @Expose()
  @IsNotEmpty()
  @IsNumberString()
  totalWinnings: string;

  @Expose()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LeaderboardEntryDto)
  myPlayer: LeaderboardEntryDto[];

  @Expose()
  @IsNotEmpty()
  @IsObject()
  meta: Meta;
}

export class CancelLudoMegaTournamentDto {
  @Expose()
  @IsOptional()
  @IsString()
  @ApiProperty({
    default: 'Technical Issue',
  })
  reason: string;
}
