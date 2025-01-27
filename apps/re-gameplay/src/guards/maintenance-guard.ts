import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { config } from '@lib/fabzen-common/configuration';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

export type UnderMaintenanceConfig = {
  underMaintenance: boolean;
};

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly remoteConfigService: RemoteConfigService) {}
  getMaintenance(): boolean {
    return (
      this.remoteConfigService.getMaintenance() ||
      this.remoteConfigService.getSpMaintenance()
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'http') {
      return true;
    }
    const client = context.switchToWs().getClient();
    const bypassKey = config.auth.maintenanceBypassKey;
    const bypassKeyParameter = client.handshake.headers.key;

    if (this.getMaintenance() === true && bypassKeyParameter !== bypassKey) {
      throw new ServiceUnavailableException({
        reason: 'maintenance',
      });
    }
    return true;
  }
}
