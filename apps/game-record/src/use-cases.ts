import {
  HistoryParameters,
  SPRoundHistoryParameters,
  SLRoundHistoryParameters,
  LeaderboardRequest,
  ScoreboardRequest,
} from '@lib/fabzen-common/types';
import { Injectable } from '@nestjs/common';
import { CbrGameHistoryRepository } from 'apps/cbr-gameplay/src/cbr-gameplay.repository';
import { ReGameHistoryRepository } from 'apps/re-gameplay/src/re-gameplay.repository';
import { SLGameMongooseRepository } from 'apps/sl-gameplay/src/domain/interfaces';
import {
  CbrHistoryResponseDto,
  LeaderboardResponseDto,
  LudoHistoryResponseDto,
  ReRoundHistoryResponseDto,
  ReTableHistoryResponseDto,
  SLGameHistoryResponseDto,
  SLRoundHistoryResponseDto,
  ScoreboardResponseDto,
  SpRoundHistoryResponseDto,
  SpTableHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/history/history.dto';
import { SpGameHistoryRepository } from 'apps/sp-gameplay/src/sp-gameplay.respository';
import { AviatorHistoryRepository } from 'apps/aviator-gameplay/src/domain/interfaces';
import { AviatorUserResponseDto } from 'apps/aviator-gameplay/src/domain/use-cases';

@Injectable()
export class GameRecordUseCases {
  constructor(
    private readonly cbrGameHistoryRepository: CbrGameHistoryRepository,
    private readonly spGameHistoryRepository: SpGameHistoryRepository,
    private readonly reGameHistoryRepository: ReGameHistoryRepository,
    private readonly slGameHistoryRepository: SLGameMongooseRepository,
    private readonly aviatorHistoryRepository: AviatorHistoryRepository,
  ) {}

  async getCbrGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<CbrHistoryResponseDto> {
    return await this.cbrGameHistoryRepository.getCbrHistory(historyParameters);
  }

  async getSLGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<SLGameHistoryResponseDto> {
    return await this.slGameHistoryRepository.getSLGameHistory(
      historyParameters,
    );
  }

  async getSLRoundHistory(
    historyParameters: SLRoundHistoryParameters,
  ): Promise<SLRoundHistoryResponseDto> {
    return await this.slGameHistoryRepository.getRoundHistory(
      historyParameters,
    );
  }

  async getSpGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<SpTableHistoryResponseDto> {
    return await this.cbrGameHistoryRepository.getSpHistory(historyParameters);
  }

  async getSpRoundHistory(
    historyParameters: SPRoundHistoryParameters,
  ): Promise<SpRoundHistoryResponseDto> {
    return await this.spGameHistoryRepository.getRoundHistory(
      historyParameters,
    );
  }

  async getReGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<ReTableHistoryResponseDto> {
    return await this.cbrGameHistoryRepository.getReHistory(historyParameters);
  }

  async getReRoundHistory(
    historyParameters: SPRoundHistoryParameters,
  ): Promise<ReRoundHistoryResponseDto> {
    return await this.reGameHistoryRepository.getRoundHistory(
      historyParameters,
    );
  }

  async getLudoGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<LudoHistoryResponseDto> {
    return await this.cbrGameHistoryRepository.getLudoHistory(
      historyParameters,
    );
  }

  async getAviatorHistory(
    historyParameters: HistoryParameters,
  ): Promise<AviatorUserResponseDto> {
    return await this.aviatorHistoryRepository.getUserHistory(
      historyParameters,
    );
  }

  async getScoreboard(
    scoreboardRequest: ScoreboardRequest,
  ): Promise<ScoreboardResponseDto> {
    return await this.cbrGameHistoryRepository.getScoreboard(scoreboardRequest);
  }

  async updateDayLeaderboard() {
    // await this.cbrGameHistoryRepository.updateDayLeaderboard();
  }

  async updateWeekLeaderboard() {
    // await this.cbrGameHistoryRepository.updateWeekLeaderboard();
  }

  async updateMonthLeaderboard() {
    // await this.cbrGameHistoryRepository.updateMonthLeaderboard();
  }

  async getLeaderboard(
    leaderboardRequest: LeaderboardRequest,
  ): Promise<LeaderboardResponseDto> {
    return await this.cbrGameHistoryRepository.getLeaderboard(
      leaderboardRequest,
    );
  }
}
