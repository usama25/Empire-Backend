import {
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
  Injectable,
} from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { ExtendedSocket } from '@lib/fabzen-common/types';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

@Injectable()
export class SLGameMaintenanceGuard implements CanActivate {
  constructor(private readonly configService: RemoteConfigService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient() as ExtendedSocket;
    const bypassKey = config.maintenance.bypassKey;
    const underMaintenance = this.configService.getSLGameMaintenance();
    const keyParameter = client.handshake.headers.key;
    if (underMaintenance === true && keyParameter !== bypassKey) {
      throw new ServiceUnavailableException({
        reason: 'maintenance',
      });
    }
    return true;
  }
}
