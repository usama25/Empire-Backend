import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { CBLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';

export class CbrGameplayProvider extends MicroserviceProvider {
  broadcastOnlineUserCount() {
    this._sendEvent(TransporterCmds.BROADCAST_ONLINE_USER_COUNT, {});
  }

  async getGameTables(cbrLiveGamesRequest: CBLiveGamesRequest) {
    return this._sendRequest(
      TransporterCmds.GET_CB_LIVE_GAMES,
      cbrLiveGamesRequest,
    );
  }

  async clearStuckTable(tableId: string) {
    return this._sendRequest(TransporterCmds.CLEAR_CB_STUCK_TABLE, { tableId });
  }
}
