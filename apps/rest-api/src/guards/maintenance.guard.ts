import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { config } from '@lib/fabzen-common/configuration';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { IS_HEALTH_CHECK_KEY } from '@lib/fabzen-common/decorators';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const isHealthCheck = this.reflector.getAllAndOverride<boolean>(
      IS_HEALTH_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isHealthCheck) {
      return true;
    }

    const bypassKey = config.maintenance.bypassKey;
    const underMaintenance = this.remoteConfigService.getMaintenance();
    const keyParameter = request.query.key as string;

    if (underMaintenance === true && keyParameter !== bypassKey) {
      throw new ServiceUnavailableException({
        reason: 'maintenance',
      });
    }
    return true;
  }
}
