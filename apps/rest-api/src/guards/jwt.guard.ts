import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext, Injectable } from '@nestjs/common';

import { IS_PUBLIC_KEY, IS_WEBHOOK_KEY } from '@lib/fabzen-common/decorators';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const isWebhook = this.reflector.getAllAndOverride<boolean>(
      IS_WEBHOOK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || isWebhook) {
      return true;
    }
    return super.canActivate(context);
  }
}
