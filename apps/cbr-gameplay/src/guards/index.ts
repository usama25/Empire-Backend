import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { ExtendedSocket } from '@lib/fabzen-common/types';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

export type UnderMaintenanceConfig = {
  underMaintenance: boolean;
};

@Injectable()
export class CbrMaintenanceGuard implements CanActivate {
  isUnderMaintenance = true; // initial value, will be updated right away

  constructor(
    @Inject(forwardRef(() => RemoteConfigService))
    private readonly configService: RemoteConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient() as ExtendedSocket;
    const bypassKey = config.maintenance.bypassKey;
    const underMaintenance = this.configService.getCbrMaintenance();
    const keyParameter = client.handshake.headers.key;
    if (underMaintenance === true && keyParameter !== bypassKey) {
      throw new ServiceUnavailableException({
        reason: 'maintenance',
      });
    }
    return true;
  }
}
