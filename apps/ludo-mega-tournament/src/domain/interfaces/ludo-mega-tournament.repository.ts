import { LudoMegaTournamentEntity } from '@lib/fabzen-common/entities/ludo-mega-tournament.entity';
import {
  LudoMegaTournamentFilterWithPagination,
  LudoMegaTournamentPrize,
  Paginated,
} from '@lib/fabzen-common/types';

import {
  CreateLudoMegaTournamentDto,
  LeaderboardDto,
} from 'apps/rest-api/src/subroutes/ludo/mega-tournament/mega-tournament.dto';
import { GetLeaderboardRequest } from '../../infrastructure/controllers/types';
import { FinishedGameInfo } from '../use-cases';
import { LudoMegaTournamentHistoryDto } from 'apps/rest-api/src/subroutes/history/history.dto';

export abstract class LudoMegaTournamentRepository {
  abstract createLudoMegaTournament(
    createLudoMegaTournamentDto: CreateLudoMegaTournamentDto,
  ): Promise<LudoMegaTournamentEntity>;

  abstract getTournamentById(
    tournamentId: string,
    userId?: string,
  ): Promise<LudoMegaTournamentEntity>;

  abstract updateTournament(
    tournamentId: string,
    updates?: Partial<LudoMegaTournamentEntity>,
  ): Promise<void>;

  abstract getTournaments(
    filter: LudoMegaTournamentFilterWithPagination,
  ): Promise<Paginated<LudoMegaTournamentEntity>>;

  abstract getLeaderboard(
    request: GetLeaderboardRequest,
  ): Promise<LeaderboardDto>;

  abstract getUserEntryCount(
    tournamentId: string,
    userId: string,
  ): Promise<number>;

  abstract storeGameResult(
    tournamentId: string,
    userId: string,
    tableId: string,
    score: number,
  ): Promise<void>;

  abstract updateLeaderboard(tournamentId: string): Promise<void>;

  abstract incrementEnteredUserCount(tournamentId: string): Promise<void>;

  abstract getFinishedGameInfo(tableId: string): Promise<FinishedGameInfo>;

  abstract getRankWithScore(
    tournamentId: string,
    score: number,
  ): Promise<number>;

  abstract getLeaderboardEntryCount(tournamentId: string): Promise<number>;

  abstract getPrizes(tournamentId: string): Promise<LudoMegaTournamentPrize[]>;

  abstract markAsCompleted(
    tournamentId: string,
    totalWinAmount: string,
  ): Promise<void>;

  abstract getLudoMegaTournamentHistory(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<Paginated<LudoMegaTournamentHistoryDto>>;

  abstract getJoinedUserIds(tournamentId: string): Promise<string[]>;
}
