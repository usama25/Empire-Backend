import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { Paginated, TransporterCmds } from '@lib/fabzen-common/types';
import { LudoMegaTournamentEntity } from '@lib/fabzen-common/entities/ludo-mega-tournament.entity';

import { CreateLudoMegaTournamentDto } from 'apps/rest-api/src/subroutes/ludo/mega-tournament/mega-tournament.dto';
import { GetLeaderboardRequest } from './infrastructure/controllers/types';
import { LudoMegaTournamentHistoryDto } from 'apps/rest-api/src/subroutes/history/history.dto';

export class LudoMegaTournamentProvider extends MicroserviceProvider {
  async createTournament(createTournamentDto: CreateLudoMegaTournamentDto) {
    return await this._sendRequest<string>(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_CREATE,
      createTournamentDto,
    );
  }

  async getTournamentById(tournamentId: string, userId: string) {
    return await this._sendRequest<LudoMegaTournamentEntity>(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_GET_BY_ID,
      {
        tournamentId,
        userId,
      },
    );
  }

  async getTournaments(
    tournamentFilter: any,
  ): Promise<LudoMegaTournamentEntity[]> {
    return await this._sendRequest<LudoMegaTournamentEntity[]>(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_GET_LIST,
      tournamentFilter,
    );
  }

  async getLeaderboard(
    request: GetLeaderboardRequest,
  ): Promise<LudoMegaTournamentEntity[]> {
    return await this._sendRequest<LudoMegaTournamentEntity[]>(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_GET_LEADERBOARD,
      request,
    );
  }

  async checkIfReconnected(userId: string): Promise<boolean> {
    return await this._sendRequest<boolean>(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_CHECK_IF_RECONNECTED,
      { userId },
    );
  }

  async cancelTournament(tournamentId: string, reason: string) {
    return await this._sendRequest<boolean>(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_CANCEL,
      { tournamentId, reason },
    );
  }

  async getLudoMegaTournamentHistory(tournamentFilter: any) {
    return await this._sendRequest<Paginated<LudoMegaTournamentHistoryDto>>(
      TransporterCmds.LUDO_MEGA_TOURNAMENT_GET_HISTORY,
      tournamentFilter,
    );
  }
}
