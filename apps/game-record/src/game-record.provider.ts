import {
  HistoryParameters,
  SPRoundHistoryParameters,
  SLRoundHistoryParameters,
  TransporterCmds,
  LeaderboardRequest,
} from '@lib/fabzen-common/types';
import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { AviatorUserResponseDto } from 'apps/aviator-gameplay/src/domain/use-cases';
import {
  CbrHistoryResponseDto,
  LeaderboardResponseDto,
  LudoHistoryResponseDto,
  ScoreboardResponseDto,
  SpRoundHistoryResponseDto,
  SpTableHistoryResponseDto,
  SLGameHistoryResponseDto,
  SLRoundHistoryResponseDto,
  ReTableHistoryResponseDto,
  ReRoundHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/history/history.dto';

export class GameRecordProvider extends MicroserviceProvider {
  async getCbrGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<CbrHistoryResponseDto> {
    return this._sendRequest<CbrHistoryResponseDto>(
      TransporterCmds.GET_CBR_GAME_HISTORY,
      historyParameters,
    );
  }

  async getSLGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<SLGameHistoryResponseDto> {
    return this._sendRequest<SLGameHistoryResponseDto>(
      TransporterCmds.GET_SL_GAME_HISTORY,
      historyParameters,
    );
  }

  async getSLRoundHistory(
    historyParameters: SLRoundHistoryParameters,
  ): Promise<SLRoundHistoryResponseDto> {
    return this._sendRequest<SLRoundHistoryResponseDto>(
      TransporterCmds.GET_SL_ROUND_HISTORY,
      historyParameters,
    );
  }

  async getSpGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<SpTableHistoryResponseDto> {
    return this._sendRequest<SpTableHistoryResponseDto>(
      TransporterCmds.GET_SP_GAME_HISTORY,
      historyParameters,
    );
  }

  async getSpRoundHistory(
    historyParameters: SPRoundHistoryParameters,
  ): Promise<SpRoundHistoryResponseDto> {
    return this._sendRequest<SpRoundHistoryResponseDto>(
      TransporterCmds.GET_SP_ROUND_HISTORY,
      historyParameters,
    );
  }

  async getReGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<ReTableHistoryResponseDto> {
    return this._sendRequest<ReTableHistoryResponseDto>(
      TransporterCmds.GET_RE_GAME_HISTORY,
      historyParameters,
    );
  }

  async getReRoundHistory(
    historyParameters: SPRoundHistoryParameters,
  ): Promise<ReRoundHistoryResponseDto> {
    return this._sendRequest<ReRoundHistoryResponseDto>(
      TransporterCmds.GET_RE_ROUND_HISTORY,
      historyParameters,
    );
  }

  async getAviatorGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<AviatorUserResponseDto> {
    return this._sendRequest<AviatorUserResponseDto>(
      TransporterCmds.GET_AVIATOR_GAME_HISTORY,
      historyParameters,
    );
  }

  async getLudoGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<LudoHistoryResponseDto> {
    return this._sendRequest<LudoHistoryResponseDto>(
      TransporterCmds.GET_LUDO_GAME_HISTORY,
      historyParameters,
    );
  }

  async getScoreboard({
    userId,
    tableId,
  }: {
    userId: string;
    tableId: string;
  }): Promise<ScoreboardResponseDto> {
    return this._sendRequest<ScoreboardResponseDto>(
      TransporterCmds.GET_CBR_SCOREBOARD,
      {
        userId,
        tableId,
      },
    );
  }

  async updateDayLeaderboard() {
    this._sendRequest<void>(TransporterCmds.UPDATE_DAY_LEADERBOARD, {});
  }

  async updateWeekLeaderboard() {
    this._sendRequest<void>(TransporterCmds.UPDATE_WEEK_LEADERBOARD, {});
  }

  async updateMonthLeaderboard() {
    this._sendRequest<void>(TransporterCmds.UPDATE_MONTH_LEADERBOARD, {});
  }

  async getLeaderboard(
    leaderboardRequest: LeaderboardRequest,
  ): Promise<LeaderboardResponseDto> {
    return await this._sendRequest(
      TransporterCmds.GET_LEADERBOARD,
      leaderboardRequest,
    );
  }
}
