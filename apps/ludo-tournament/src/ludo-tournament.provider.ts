import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types';
import {
  GetLeaderboardRequest,
  RoundEndFullResult,
  RoundEndResponse,
  RoundEndResult,
  RoundResult,
} from './ludo-tournament.types';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
} from 'apps/rest-api/src/subroutes/ludo/tournament/tournament.dto';

export class LudoTournamentProvider extends MicroserviceProvider {
  async endRound(
    tournamentId: string,
    roundNo: number,
    roundEndResults: RoundEndResult[],
  ): Promise<RoundEndResponse> {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_END_ROUND,
      {
        tournamentId,
        roundNo,
        roundEndResults,
      },
    );
  }

  async endSomeRoundGamesEarlier(
    roundEndFullResult: RoundEndFullResult,
  ): Promise<RoundEndResponse> {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_END_SOME_ROUND_GAMES_EARLIER,
      roundEndFullResult,
    );
  }

  ignoreTournament(tournamentId: string, userId: string) {
    this._sendEvent(TransporterCmds.LUDO_TOURNAMENT_IGNORE, {
      tournamentId,
      userId,
    });
  }

  async createTournament(createTournamentDto: CreateTournamentDto) {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_CREATE,
      createTournamentDto,
    );
  }

  async updateTournament(
    tournamentId: string,
    updateTournamentDto: UpdateTournamentDto,
  ) {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_UPDATE,
      {
        tournamentId,
        updateTournamentDto,
      },
    );
  }

  async getTournamentById(tournamentId: string, userId: string) {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_GET_BY_ID,
      {
        tournamentId,
        userId,
      },
    );
  }

  async getTournaments(tournamentFilter: any) {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_GET_LIST,
      tournamentFilter,
    );
  }

  startTournament(tournamentId: string) {
    this._sendRequest(TransporterCmds.LUDO_TOURNAMENT_START, {
      tournamentId,
    });
  }

  async joinTournament(tournamentId: string, userId: string) {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_JOIN,
      { tournamentId, userId },
    );
  }

  cancelTournament(tournamentId: string) {
    this._sendEvent(TransporterCmds.LUDO_TOURNAMENT_CANCEL, {
      tournamentId,
    });
  }

  async getLeaderboard(request: GetLeaderboardRequest) {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_GET_LEADERBOARD,
      request,
    );
  }

  async getRoundInfo(tournamentId: string, roundNo: number, userId: string) {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_GET_ROUND_INFO,
      {
        tournamentId,
        roundNo,
        userId,
      },
    );
  }

  async getFinishedRounds(tournamentId: string, userId: string) {
    return await this._sendRequest<RoundResult>(
      TransporterCmds.LUDO_TOURNAMENT_GET_FINISHED_ROUNDS,
      {
        tournamentId,
        userId,
      },
    );
  }

  async checkIfFinished(tournamentId: string, roundNo: number, userId: string) {
    return await this._sendRequest<RoundEndResponse>(
      TransporterCmds.LUDO_TOURNAMENT_CHECK_IF_FINISHED,
      {
        tournamentId,
        roundNo,
        userId,
      },
    );
  }

  async getUserStatus(tournamentId: string, userId: string) {
    return await this._sendRequest<RoundResult>(
      TransporterCmds.LUDO_TOURNAMENT_GET_USER_STATUS,
      {
        tournamentId,
        userId,
      },
    );
  }

  async getMyRank(tournamentId: string, userId: string) {
    return await this._sendRequest<RoundResult>(
      TransporterCmds.LUDO_TOURNAMENT_GET_MY_RANK,
      {
        tournamentId,
        userId,
      },
    );
  }
}
