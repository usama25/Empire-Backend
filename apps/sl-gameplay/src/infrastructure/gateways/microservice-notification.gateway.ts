import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { TransporterProviders } from '@lib/fabzen-common/types';

import { NotificationProvider } from 'apps/notification/src/notification.provider';
import { NotificationGateway } from '../../domain/interfaces/notification.gateway';
import { SocketGatewayProvider } from 'apps/socket-gateway/src/socket-gateway.provider';

@Injectable()
export class MicroserviceNotificationGateway implements NotificationGateway {
  private readonly logger = new Logger(MicroserviceNotificationGateway.name);
  private readonly notificationProvider: NotificationProvider;
  private readonly socketGatewayProvider: SocketGatewayProvider;

  constructor(
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
    @Inject(TransporterProviders.SOCKET_GATEWAY_SERVICE)
    private socketGatewayClient: ClientProxy,
  ) {
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );
    this.socketGatewayProvider = new SocketGatewayProvider(
      this.socketGatewayClient,
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

  async sendSocketNotification(
    userIds: string[],
    deepLink: string,
  ): Promise<void> {
    await this.socketGatewayProvider.sendMatchMakingSocketNotification(
      userIds,
      deepLink,
    );
  }
}
