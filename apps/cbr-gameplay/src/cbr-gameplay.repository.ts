import {
  CbrHistoryDto,
  HistoryParameters,
  LeaderboardRequest,
  ScoreboardRequest,
} from '@lib/fabzen-common/types';
import {
  CbrHistoryResponseDto,
  LeaderboardResponseDto,
  LudoHistoryResponseDto,
  ReTableHistoryResponseDto,
  ScoreboardResponseDto,
  SpTableHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/history/history.dto';

export abstract class CbrGameHistoryRepository {
  abstract createCbrHistory(newTableHistory: CbrHistoryDto): Promise<void>;
  abstract getCbrHistory(
    historyParameters: HistoryParameters,
  ): Promise<CbrHistoryResponseDto>;
  abstract getSpHistory(
    historyParameters: HistoryParameters,
  ): Promise<SpTableHistoryResponseDto>;
  abstract getReHistory(
    historyParameters: HistoryParameters,
  ): Promise<ReTableHistoryResponseDto>;
  abstract getLudoHistory(
    historyParameters: HistoryParameters,
  ): Promise<LudoHistoryResponseDto>;
  abstract getScoreboard(
    scoreboardRequest: ScoreboardRequest,
  ): Promise<ScoreboardResponseDto>;
  abstract updateDayLeaderboard(): Promise<void>;
  abstract updateWeekLeaderboard(): Promise<void>;
  abstract updateMonthLeaderboard(): Promise<void>;
  abstract getLeaderboard(
    leaderboardRequest: LeaderboardRequest,
  ): Promise<LeaderboardResponseDto>;
}

export const createMockGameHistoryRepository =
  (): CbrGameHistoryRepository => ({
    createCbrHistory: jest.fn(),
    getCbrHistory: jest.fn(),
    getSpHistory: jest.fn(),
    getReHistory: jest.fn(),
    getLudoHistory: jest.fn(),
    getScoreboard: jest.fn(),
    updateDayLeaderboard: jest.fn(),
    updateWeekLeaderboard: jest.fn(),
    updateMonthLeaderboard: jest.fn(),
    getLeaderboard: jest.fn(),
  });
