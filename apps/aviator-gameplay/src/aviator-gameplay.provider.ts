import { TransporterCmds } from '@lib/fabzen-common/types';
import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';

export class AviatorGameplayProvider extends MicroserviceProvider {
  async checkIfReconnected(userId: string): Promise<boolean> {
    return await this._sendRequest<boolean>(
      TransporterCmds.AVIATOR_CHECK_IF_RECONNECTED,
      { userId },
    );
  }
}
