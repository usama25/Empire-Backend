import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { SPLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';

export class SPGameplayProvider extends MicroserviceProvider {
  matchGames() {
    this._sendEvent(TransporterCmds.SP_MATCH_GAMES, {});
  }

  broadcastOnlineUserCount() {
    this._sendEvent(TransporterCmds.BROADCAST_ONLINE_USER_COUNT, {});
  }

  async getGameTables(spLiveGamesRequest: SPLiveGamesRequest) {
    return this._sendRequest(
      TransporterCmds.GET_SP_LIVE_GAMES,
      spLiveGamesRequest,
    );
  }

  async clearStuckTable(tableId: string) {
    return this._sendRequest(TransporterCmds.CLEAR_SP_STUCK_TABLE, { tableId });
  }
}
