import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { UserRepository } from 'apps/user/src/domain/interfaces';

@Injectable()
export class BlockUserGuard implements CanActivate {
  constructor(private readonly userRepository: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    if (!client.user) {
      return true;
    }
    const userId = client.user.userId;
    const isBlocked = await this.userRepository.getUserBlocked(userId);
    if (isBlocked) {
      throw new ForbiddenException({
        message: 'User Blocked',
        statusCode: 403,
      });
    }
    return true;
  }
}
