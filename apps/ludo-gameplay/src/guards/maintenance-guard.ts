import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { ExtendedSocket } from '@lib/fabzen-common/types';
import { LudoRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

@Injectable()
export class LudoMaintenanceGuard implements CanActivate {
  constructor(private readonly ludoRemoteConfig: LudoRemoteConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient() as ExtendedSocket;
    const bypassKey = config.maintenance.bypassKey;
    const underMaintenance = this.ludoRemoteConfig.isUnderMaintenance();
    const keyParameter = client.handshake.headers.key;
    if (underMaintenance && keyParameter !== bypassKey) {
      throw new ServiceUnavailableException('maintenance');
    }
    return true;
  }
}
