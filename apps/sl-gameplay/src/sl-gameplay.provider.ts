import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { SLLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';

export class SLGameProvider extends MicroserviceProvider {
  async checkIfReconnected(userId: string): Promise<boolean> {
    return await this._sendRequest<boolean>(
      TransporterCmds.SL_CHECK_IF_RECONNECTED,
      { userId },
    );
  }

  async getGameTables(slLiveGamesRequest: SLLiveGamesRequest) {
    return await this._sendRequest(
      TransporterCmds.GET_SL_LIVE_GAMES,
      slLiveGamesRequest,
    );
  }

  async clearStuckTable(tableId: string) {
    return this._sendRequest(TransporterCmds.CLEAR_SL_STUCK_TABLE, { tableId });
  }
}
