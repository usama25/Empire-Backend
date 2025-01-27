import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import {
  LudoMegaTournamentFilterWithPagination,
  TransporterCmds,
} from '@lib/fabzen-common/types';
import { MessageData } from '@lib/fabzen-common/decorators';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';

import { CreateLudoMegaTournamentDto } from 'apps/rest-api/src/subroutes/ludo/mega-tournament/mega-tournament.dto';
import {
  LudoMegaTournamentGameplayUseCases,
  LudoMegaTournamentUseCases,
} from '../../domain/use-cases';
import { GetLeaderboardRequest } from './types';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class LudoMegaTournamentTrasporterController {
  constructor(
    private readonly tournamentUseCases: LudoMegaTournamentUseCases,
    private readonly gameplayUserCases: LudoMegaTournamentGameplayUseCases,
  ) {}

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_CREATE)
  async createTournament(
    @MessageData() createLudoMegaTournamentDto: CreateLudoMegaTournamentDto,
  ) {
    return await this.tournamentUseCases.createLudoMegaTournament(
      createLudoMegaTournamentDto,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_GET_BY_ID)
  async getTournamentById(
    @MessageData()
    { tournamentId, userId }: { tournamentId: string; userId: string },
  ) {
    return await this.tournamentUseCases.getTournamentById(
      tournamentId,
      userId,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_GET_LIST)
  async getTournaments(
    @MessageData()
    filter: LudoMegaTournamentFilterWithPagination,
  ) {
    return await this.tournamentUseCases.getTournaments(filter);
  }

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_GET_LEADERBOARD)
  async getLeaderboard(
    @MessageData()
    request: GetLeaderboardRequest,
  ) {
    return await this.tournamentUseCases.getLeaderboard(request);
  }

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_CHECK_IF_RECONNECTED)
  async checkIfReconnected(
    @MessageData()
    { userId }: { userId: string },
  ) {
    return await this.gameplayUserCases.checkIfReconnected(userId);
  }

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_CANCEL)
  async cancelTournament(
    @MessageData()
    { tournamentId }: { tournamentId: string; reason: string },
  ) {
    return await this.tournamentUseCases.cancelTournament(tournamentId);
  }

  @MessagePattern(TransporterCmds.LUDO_MEGA_TOURNAMENT_GET_HISTORY)
  async getLudoMegaTournamentHistory(
    @MessageData()
    { userId, skip, limit }: { userId: string; skip: number; limit: number },
  ) {
    return await this.tournamentUseCases.getLudoMegaTournamentHistory(
      userId,
      skip,
      limit,
    );
  }
}
