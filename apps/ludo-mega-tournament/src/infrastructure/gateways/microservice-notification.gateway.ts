import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { TransporterProviders } from '@lib/fabzen-common/types';

import { NotificationProvider } from 'apps/notification/src/notification.provider';
import { NotificationServiceGateway } from '../../domain/interfaces/notification-service.gateway';

@Injectable()
export class MicroserviceNotificationServiceGateway
  implements NotificationServiceGateway
{
  private readonly logger = new Logger(
    MicroserviceNotificationServiceGateway.name,
  );
  private readonly notificationProvider: NotificationProvider;

  constructor(
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
  ) {
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );
  }
  async sendPushNotification(
    userIds: string[],
    title: string,
    content: string,
    deepLink: string,
  ): Promise<void> {
    await this.notificationProvider.sendMassPushNotifications(
      userIds,
      title,
      content,
      deepLink,
    );
  }
}
