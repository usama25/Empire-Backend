import { Observable } from 'rxjs';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from '@lib/fabzen-common/types';
import { ROLES } from '@lib/fabzen-common/decorators';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const roles = this.reflector.get<Role[]>(ROLES, context.getHandler());
    const user = request.user;

    if (!user) {
      return false;
    }

    if (!roles) {
      return true;
    }

    return roles.some((r) => user.roles.includes(r));
  }
}
