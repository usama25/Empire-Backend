import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { EPLRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces/epl-config.interface';

@Injectable()
export class EPLGameMaintenanceGuard implements CanActivate {
  constructor(private readonly configService: EPLRemoteConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const bypassKey = config.maintenance.bypassKey;
    const underMaintenance = this.configService.isUnderMaintenance();
    const keyParameter = client.handshake.headers.key;
    if (underMaintenance && keyParameter !== bypassKey) {
      throw new ServiceUnavailableException('maintenance');
    }
    return true;
  }
}
