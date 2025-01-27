import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { verifyJwtTokenInSocketIo } from '../utils/jwt.util';

@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | any | Promise<boolean | any> {
    const client = context.switchToWs().getClient();
    return verifyJwtTokenInSocketIo(client);
  }
}
