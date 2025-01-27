import { Injectable } from '@nestjs/common';
import { InAppEventService } from '../interfaces/in-app-event.gateway';
import { UserRepository } from 'apps/user/src/domain/interfaces';

@Injectable()
export class InAppEventUseCases {
  constructor(
    private readonly appsflyerService: InAppEventService,
    private readonly userRepository: UserRepository,
  ) {}

  async sendEvent(
    userId: string,
    eventName: string,
    eventValue: string | undefined,
  ) {
    const inAppEventIds =
      await this.userRepository.getUserInAppEventIds(userId);

    await this.appsflyerService.sendEvent(inAppEventIds, eventName, eventValue);
  }
}
