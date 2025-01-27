import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable } from '@nestjs/common';

import { TransporterProviders } from '@lib/fabzen-common/types';
import { MongooseLudoTournamentRepository } from '@lib/fabzen-common/mongoose/repositories/mongoose-ludo-tournament.repository';
import { config } from '@lib/fabzen-common/configuration';

import { UserRepository } from 'apps/user/src/domain/interfaces';
import { SocketGatewayProvider } from 'apps/socket-gateway/src/socket-gateway.provider';
import { PushNotificationGateway } from '../interfaces/push-notification.gateway';
import { TournamentInfoForPushNotification } from '../../notification.types';

@Injectable()
export class PushNotificationUseCases {
  private readonly socketGatewayProvider: SocketGatewayProvider;

  constructor(
    private readonly pushNotificationGateway: PushNotificationGateway,
    private readonly ludoTournamentRepository: MongooseLudoTournamentRepository,
    private readonly userRepository: UserRepository,
    @Inject(TransporterProviders.SOCKET_GATEWAY_SERVICE)
    private socketGatewayClient: ClientProxy,
  ) {
    this.socketGatewayProvider = new SocketGatewayProvider(
      this.socketGatewayClient,
    );
  }

  async sendLudoTournamentNotification(tournamentId: string, index: number) {
    const tournamentInfo = await this.#getTournamentInfo(tournamentId);
    const notificationInfo = config.ludoTournament.notificationsBefore[index];
    const {
      pushNotification: { enabled, useSound },
      socketEvent,
    } = notificationInfo;
    if (enabled) {
      this.pushNotificationGateway.sendPushNotificationForLudoTournament(
        tournamentInfo,
        useSound,
      );
    }
    if (socketEvent) {
      this.socketGatewayProvider.sendSocketNotificationForLudoTournament(
        tournamentId,
      );
    }
  }

  async sendPushNotification(
    userId: string,
    title: string,
    content: string,
    deepLink: string,
  ) {
    if (config.isJest || config.isLocal) {
      return;
    }
    const externalId = await this.#getUserExternalId(userId);
    this.pushNotificationGateway.sendPushNotification(
      externalId,
      title,
      content,
      deepLink,
    );
  }

  async sendMassPushNotification(
    userIds: string[],
    title: string,
    content: string,
    deepLink: string,
  ) {
    if (!config.isJest) {
      const externalIds = await this.#getMassUserExternalId(userIds);
      if (externalIds.length === 0) {
        return;
      }
      this.pushNotificationGateway.sendMassPushNotification(
        externalIds,
        title,
        content,
        deepLink,
      );
    }
  }

  async #getTournamentInfo(
    tournamentId: string,
  ): Promise<TournamentInfoForPushNotification> {
    return await this.ludoTournamentRepository.getTournamentInfoForPushNotification(
      tournamentId,
    );
  }

  async #getUserExternalId(userId: string): Promise<string> {
    return await this.userRepository.getUserExternalIdForPushNotification(
      userId,
    );
  }

  async #getMassUserExternalId(userIds: string[]): Promise<string[]> {
    return await this.userRepository.getMassUserExternalIdsForPushNotification(
      userIds,
    );
  }
}
