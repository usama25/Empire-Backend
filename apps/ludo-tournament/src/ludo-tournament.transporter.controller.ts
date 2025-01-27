import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { Controller, UseInterceptors } from '@nestjs/common';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { MessageData } from '@lib/fabzen-common/decorators';
import {
  GetLeaderboardRequest,
  RoundEndFullResult,
  TournamentFilterWithPagination,
} from './ludo-tournament.types';
import { LudoTournamentService } from './ludo-tournament.service';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
} from 'apps/rest-api/src/subroutes/ludo/tournament/tournament.dto';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class LudoTournamentTransporterController {
  constructor(private readonly ludoTournamentService: LudoTournamentService) {}

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_END_ROUND)
  async endRound(
    @MessageData()
    { tournamentId, roundNo, roundEndResults }: RoundEndFullResult,
  ) {
    return await this.ludoTournamentService.endRound(
      tournamentId,
      roundNo,
      roundEndResults,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_END_SOME_ROUND_GAMES_EARLIER)
  async endSomeRoundGamesEarlier(
    @MessageData()
    { tournamentId, roundNo, roundEndResults }: RoundEndFullResult,
  ) {
    return await this.ludoTournamentService.endSomeRoundGamesEarlier(
      tournamentId,
      roundNo,
      roundEndResults,
    );
  }

  @EventPattern(TransporterCmds.LUDO_TOURNAMENT_IGNORE)
  async ignoreTournament(
    @MessageData()
    { tournamentId, userId }: { tournamentId: string; userId: string },
  ) {
    await this.ludoTournamentService.ignoreTournament(tournamentId, userId);
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_CREATE)
  async createTournament(
    @MessageData()
    createTournamentDto: CreateTournamentDto,
  ) {
    return await this.ludoTournamentService.createTournament(
      createTournamentDto,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_UPDATE)
  async updateTournament(
    @MessageData()
    {
      tournamentId,
      updateTournamentDto,
    }: {
      tournamentId: string;
      updateTournamentDto: UpdateTournamentDto;
    },
  ) {
    return await this.ludoTournamentService.updateTournament(
      tournamentId,
      updateTournamentDto,
    );
  }

  @EventPattern(TransporterCmds.LUDO_TOURNAMENT_START)
  async startTournament(
    @MessageData()
    { tournamentId }: { tournamentId: string },
  ) {
    await this.ludoTournamentService.startTournament(tournamentId);
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_JOIN)
  async joinTournament(
    @MessageData()
    { tournamentId, userId }: { tournamentId: string; userId: string },
  ) {
    return await this.ludoTournamentService.joinTournament(
      tournamentId,
      userId,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_GET_BY_ID)
  async getTournamentById(
    @MessageData()
    { tournamentId, userId }: { tournamentId: string; userId: string },
  ) {
    return await this.ludoTournamentService.getTournamentById(
      tournamentId,
      userId,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_GET_LIST)
  async getTournaments(
    @MessageData()
    tournamentFilter: TournamentFilterWithPagination,
  ) {
    return await this.ludoTournamentService.getTournaments(tournamentFilter);
  }

  @EventPattern(TransporterCmds.LUDO_TOURNAMENT_CANCEL)
  async cancelTournament(
    @MessageData()
    { tournamentId, reason }: { tournamentId: string; reason: string },
  ) {
    await this.ludoTournamentService.cancelTournament(tournamentId, reason);
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_GET_LEADERBOARD)
  async getLeaderboard(
    @MessageData()
    request: GetLeaderboardRequest,
  ) {
    return await this.ludoTournamentService.getLeaderboard(request);
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_GET_ROUND_INFO)
  async getRoundInfo(
    @MessageData()
    {
      tournamentId,
      roundNo,
      userId,
    }: {
      tournamentId: string;
      roundNo: number;
      userId: string;
    },
  ) {
    return await this.ludoTournamentService.getRoundInfo(
      tournamentId,
      roundNo,
      userId,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_GET_FINISHED_ROUNDS)
  async getFinishedRounds(
    @MessageData()
    { tournamentId, userId }: { tournamentId: string; userId: string },
  ) {
    return await this.ludoTournamentService.getFinishedRounds(
      tournamentId,
      userId,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_CHECK_IF_FINISHED)
  async checkIfFinished(
    @MessageData()
    {
      tournamentId,
      roundNo,
      userId,
    }: {
      tournamentId: string;
      roundNo: number;
      userId: string;
    },
  ) {
    return await this.ludoTournamentService.checkIfFinished(
      tournamentId,
      roundNo,
      userId,
    );
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_GET_USER_STATUS)
  async getUserStatus(
    @MessageData()
    { tournamentId, userId }: { tournamentId: string; userId: string },
  ) {
    return await this.ludoTournamentService.getUserStatus(tournamentId, userId);
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_GET_MY_RANK)
  async getMyRank(
    @MessageData()
    { tournamentId, userId }: { tournamentId: string; userId: string },
  ) {
    return await this.ludoTournamentService.getMyRank(tournamentId, userId);
  }
}
