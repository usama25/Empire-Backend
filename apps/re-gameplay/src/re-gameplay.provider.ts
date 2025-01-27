import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { RELiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';

export class ReGameplayProvider extends MicroserviceProvider {
  matchGames() {
    this._sendEvent(TransporterCmds.RE_MATCH_GAMES, {});
  }

  broadcastOnlineUserCount() {
    this._sendEvent(TransporterCmds.BROADCAST_ONLINE_USER_COUNT, {});
  }

  async getGameTables(reLiveGamesRequest: RELiveGamesRequest) {
    return this._sendRequest(
      TransporterCmds.GET_RE_LIVE_GAMES,
      reLiveGamesRequest,
    );
  }

  async checkIfReconnected(userId: string): Promise<boolean> {
    return await this._sendRequest<boolean>(
      TransporterCmds.RE_CHECK_IF_RECONNECTED,
      { userId },
    );
  }

  async clearStuckTable(tableId: string) {
    return this._sendRequest(TransporterCmds.CLEAR_RE_STUCK_TABLE, { tableId });
  }
}
