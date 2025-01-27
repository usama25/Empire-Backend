import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { TournamentChangedEvent } from 'apps/ludo-tournament/src/ludo-tournament.types';
import {
  GetRoundInfoRequest,
  PlayerDetail,
  RoundStartEvent,
  TournamentForceTerminatedEvent,
} from './ludo-gameplay.types';

export class LudoGameplayProvider extends MicroserviceProvider {
  endGame(tableId: string) {
    this._sendRequest(TransporterCmds.LUDO_END_GAME, {
      tableId,
    });
  }

  endRound(tournamentId: string, roundNo: number, tableId: string | undefined) {
    this._sendRequest(TransporterCmds.LUDO_END_ROUND, {
      tournamentId,
      roundNo,
      tableId,
    });
  }

  matchNormalGames(shouldBroadcastTableList: boolean) {
    this._sendEvent(TransporterCmds.LUDO_MATCH_NORMAL_GAMES, {
      shouldBroadcastTableList,
    });
  }

  tournamentChanged(tournamentChangedEvent: TournamentChangedEvent) {
    this._sendEvent(TransporterCmds.LUDO_TOURNAMENT_CHANGED, {
      tournamentChangedEvent,
    });
  }

  startRound(roundStartEvent: RoundStartEvent) {
    this._sendRequest(TransporterCmds.LUDO_TOURNAMENT_START_ROUND, {
      roundStartEvent,
    });
  }

  tournamentCanceled(tournamentChangedEvent: TournamentForceTerminatedEvent) {
    this._sendRequest(
      TransporterCmds.LUDO_TOURNAMENT_CANCELED,
      tournamentChangedEvent,
    );
  }

  broadcastOnlineUserCount() {
    this._sendEvent(TransporterCmds.BROADCAST_ONLINE_USER_COUNT, {});
  }

  async getRoundPlayers(getRoundInfoRequest: GetRoundInfoRequest) {
    return await this._sendRequest<PlayerDetail[]>(
      TransporterCmds.LUDO_TOURNAMENT_GET_ROUND_PLAYERS,
      getRoundInfoRequest,
    );
  }
}
