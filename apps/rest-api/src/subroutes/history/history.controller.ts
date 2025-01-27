import { config } from '@lib/fabzen-common/configuration';
import { ApiValidatedOkResponse, UserID } from '@lib/fabzen-common/decorators';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { DWM, Games, TransporterProviders } from '@lib/fabzen-common/types';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameRecordProvider } from 'apps/game-record/src/game-record.provider';
import {
  CbrHistoryResponseDto,
  LudoHistoryResponseDto,
  SpTableHistoryResponseDto,
  ScoreboardResponseDto,
  SpRoundHistoryResponseDto,
  LeaderboardResponseDto,
  SLRoundHistoryResponseDto,
  SLGameHistoryResponseDto,
  ReTableHistoryResponseDto,
  ReRoundHistoryResponseDto,
} from './history.dto';
import { LudoMegaTournamentProvider } from 'apps/ludo-mega-tournament/src/ludo-mega-tournament.provider';

@ApiBearerAuth()
@ApiTags('History')
@Controller()
export class HistoryController {
  private readonly gameRecordProvider: GameRecordProvider;
  private readonly ludoMegaTournamentProvider: LudoMegaTournamentProvider;

  constructor(
    @Inject(TransporterProviders.RECORD_SERVICE)
    private gameRecordClient: ClientProxy,
    @Inject(TransporterProviders.LUDO_MEGA_TOURNAMENT_SERVICE)
    private ludoMegaTournamentClient: ClientProxy,
  ) {
    this.gameRecordProvider = new GameRecordProvider(this.gameRecordClient);
    this.ludoMegaTournamentProvider = new LudoMegaTournamentProvider(
      this.ludoMegaTournamentClient,
    );
  }

  @Get('/callbreak')
  @ApiOperation({ summary: 'Get Callbreak Game History' })
  @ApiValidatedOkResponse(CbrHistoryResponseDto)
  async getCbrHistory(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = Number(skip || config.restApi.defaultParams.skip);
    limit = Number(limit || config.restApi.defaultParams.limit);
    return await this.gameRecordProvider.getCbrGameHistory({
      userId,
      skip,
      limit,
    });
  }

  @Get('/snakesandladders')
  @ApiOperation({ summary: 'Get Snakes&Ladders Game History' })
  @ApiValidatedOkResponse(SLGameHistoryResponseDto)
  async getSLGameHistory(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = Number(skip || config.restApi.defaultParams.skip);
    limit = Number(limit || config.restApi.defaultParams.limit);
    return await this.gameRecordProvider.getSLGameHistory({
      userId,
      skip,
      limit,
    });
  }

  @Get('/snakesandladders/:tableId')
  @ApiOperation({ summary: 'Get Snakes&Ladders Table History with tableId' })
  @ApiValidatedOkResponse(SLRoundHistoryResponseDto)
  async getSLRoundHistory(
    @UserID() userId: string,
    @Param('tableId') tableId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.gameRecordProvider.getSLRoundHistory({
      userId,
      tableId,
      skip,
      limit,
    });
  }

  @Get('/skillpatti')
  @ApiOperation({ summary: 'Get Skillpatti Table History' })
  @ApiValidatedOkResponse(SpTableHistoryResponseDto)
  async getSpHistory(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.gameRecordProvider.getSpGameHistory({
      userId,
      skip,
      limit,
    });
  }

  @Get('/skillpatti/:tableId')
  @ApiOperation({ summary: 'Get Skillpatti Table History' })
  @ApiValidatedOkResponse(SpRoundHistoryResponseDto)
  async getSpRoundHistory(
    @UserID() userId: string,
    @Param('tableId') tableId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.gameRecordProvider.getSpRoundHistory({
      userId,
      tableId,
      skip,
      limit,
    });
  }

  @Get('/rummy')
  @ApiOperation({ summary: 'Get Rummyempire Table History' })
  @ApiValidatedOkResponse(ReTableHistoryResponseDto)
  async getReHistory(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.gameRecordProvider.getReGameHistory({
      userId,
      skip,
      limit,
    });
  }

  @Get('/rummy/:tableId')
  @ApiOperation({ summary: 'Get Rummyempire Table History' })
  @ApiValidatedOkResponse(ReRoundHistoryResponseDto)
  async getReRoundHistory(
    @UserID() userId: string,
    @Param('tableId') tableId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.gameRecordProvider.getReRoundHistory({
      userId,
      tableId,
      skip,
      limit,
    });
  }

  @Get('/ludo')
  @ApiOperation({ summary: 'Get Ludo Game History' })
  @ApiValidatedOkResponse(LudoHistoryResponseDto)
  async getLudoHistory(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = Number(skip || config.restApi.defaultParams.skip);
    limit = Number(limit || config.restApi.defaultParams.limit);
    return await this.gameRecordProvider.getLudoGameHistory({
      userId,
      skip,
      limit,
    });
  }

  @Get('/callbreak/scoreboard')
  @ApiOperation({ summary: 'Get Callbreak Scoreboard' })
  @ApiValidatedOkResponse(ScoreboardResponseDto)
  async getScoreboard(
    @UserID() userId: string,
    @Query('tableId') tableId: string,
  ) {
    return await this.gameRecordProvider.getScoreboard({
      userId,
      tableId,
    });
  }

  @Get('/leaderboard')
  @ApiOperation({
    summary:
      'Get Empire Game Leaderboard. dwm(day, week, month) game(callbreak, ludo, skillpatti etc)',
  })
  @ApiValidatedOkResponse(LeaderboardResponseDto)
  async getCallbreakDayLeaderboard(
    @Query('skip') skip: number,
    @Query('limit') limit: number,
    @Query('game') game: Games,
    @Query('dwm') dwm: DWM,
    @UserID() userId: string,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.gameRecordProvider.getLeaderboard({
      skip,
      limit,
      game,
      dwm,
      userId,
    });
  }

  @Get('/ludoMegaTournament')
  async getLudoMegaTournamentHistory(
    @Query('skip') skip: number,
    @Query('limit') limit: number,
    @UserID() userId: string,
  ) {
    const megaTournamenthistory =
      await this.ludoMegaTournamentProvider.getLudoMegaTournamentHistory({
        userId,
        skip: Number(skip || config.restApi.defaultParams.skip),
        limit: Number(limit || config.restApi.defaultParams.limit),
      });
    // Change format based on FE requirements
    const { items, meta } = megaTournamenthistory;
    return {
      history: items,
      meta,
    };
  }

  @Get('/aviator')
  @ApiOperation({ summary: 'Get Aviator History' })
  async getUserHistory(
    @UserID() userId: string,
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    skip = skip || config.restApi.defaultParams.skip;
    limit = limit || config.restApi.defaultParams.limit;
    return await this.gameRecordProvider.getAviatorGameHistory({
      userId,
      skip,
      limit,
    });
  }
}
