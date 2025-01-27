import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { LudoMegaTournamentRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

@Injectable()
export class LudoMegaTournamentMaintenanceGuard implements CanActivate {
  constructor(
    private readonly configService: LudoMegaTournamentRemoteConfigService,
  ) {}

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
