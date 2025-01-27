import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import {
  HistoryParameters,
  TransporterCmds,
  ScoreboardRequest,
  SPRoundHistoryParameters,
  SLRoundHistoryParameters,
  LeaderboardRequest,
} from '@lib/fabzen-common/types';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { MessageData } from '@lib/fabzen-common/decorators';
import { GameRecordUseCases } from './use-cases';
import {
  CbrHistoryResponseDto,
  LudoHistoryResponseDto,
  ScoreboardResponseDto,
  SpRoundHistoryResponseDto,
  SLRoundHistoryResponseDto,
  SpTableHistoryResponseDto,
  SLGameHistoryResponseDto,
  ReTableHistoryResponseDto,
  ReRoundHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/history/history.dto';
import { AviatorUserResponseDto } from 'apps/aviator-gameplay/src/domain/use-cases';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class GameRecordTransporterController {
  constructor(private readonly gameRecordUsecases: GameRecordUseCases) {}

  @MessagePattern(TransporterCmds.GET_CBR_GAME_HISTORY)
  async getCbrGameHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<CbrHistoryResponseDto> {
    return await this.gameRecordUsecases.getCbrGameHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_SL_GAME_HISTORY)
  async getSLGameHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<SLGameHistoryResponseDto> {
    return await this.gameRecordUsecases.getSLGameHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_SL_ROUND_HISTORY)
  async getSLRoundHistory(
    @MessageData() historyParameters: SLRoundHistoryParameters,
  ): Promise<SLRoundHistoryResponseDto> {
    return await this.gameRecordUsecases.getSLRoundHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_SP_GAME_HISTORY)
  async getSpGameHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<SpTableHistoryResponseDto> {
    return await this.gameRecordUsecases.getSpGameHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_SP_ROUND_HISTORY)
  async getSpRoundHistory(
    @MessageData() historyParameters: SPRoundHistoryParameters,
  ): Promise<SpRoundHistoryResponseDto> {
    return await this.gameRecordUsecases.getSpRoundHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_RE_GAME_HISTORY)
  async getReGameHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<ReTableHistoryResponseDto> {
    return await this.gameRecordUsecases.getReGameHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_RE_ROUND_HISTORY)
  async getReRoundHistory(
    @MessageData() historyParameters: SPRoundHistoryParameters,
  ): Promise<ReRoundHistoryResponseDto> {
    return await this.gameRecordUsecases.getReRoundHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_LUDO_GAME_HISTORY)
  async getLudoGameHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<LudoHistoryResponseDto> {
    return await this.gameRecordUsecases.getLudoGameHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.GET_CBR_SCOREBOARD)
  async getCbrScoreboard(
    @MessageData() scoreboardRequest: ScoreboardRequest,
  ): Promise<ScoreboardResponseDto> {
    return await this.gameRecordUsecases.getScoreboard(scoreboardRequest);
  }

  @MessagePattern(TransporterCmds.GET_AVIATOR_GAME_HISTORY)
  async getAviatorGameHistory(
    @MessageData() historyParameters: HistoryParameters,
  ): Promise<AviatorUserResponseDto> {
    return await this.gameRecordUsecases.getAviatorHistory(historyParameters);
  }

  @MessagePattern(TransporterCmds.UPDATE_DAY_LEADERBOARD)
  async updateDayLeaderboard() {
    await this.gameRecordUsecases.updateDayLeaderboard();
  }

  @MessagePattern(TransporterCmds.UPDATE_WEEK_LEADERBOARD)
  async updateWeekLeaderboard() {
    await this.gameRecordUsecases.updateWeekLeaderboard();
  }

  @MessagePattern(TransporterCmds.UPDATE_MONTH_LEADERBOARD)
  async updateMonthLeaderboard() {
    await this.gameRecordUsecases.updateMonthLeaderboard();
  }

  @MessagePattern(TransporterCmds.GET_LEADERBOARD)
  async getLeaderboard(@MessageData() leaderboardRequest: LeaderboardRequest) {
    return await this.gameRecordUsecases.getLeaderboard(leaderboardRequest);
  }
}
