/* eslint-disable unicorn/prevent-abbreviations */

import { Injectable, Logger } from '@nestjs/common';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { config } from '@lib/fabzen-common/configuration';
import { convertUtcToIst } from '@lib/fabzen-common/utils/time.utils';

import { PushNotificationGateway } from '../../domain/interfaces/push-notification.gateway';
import { TournamentInfoForPushNotification } from '../../notification.types';

@Injectable()
export class OneSignalPushNotificationGateway
  implements PushNotificationGateway
{
  private readonly logger = new Logger(OneSignalPushNotificationGateway.name);

  constructor(private readonly httpClientService: HttpClientService) {}

  async sendPushNotificationForLudoTournament(
    tournamentInfo: TournamentInfoForPushNotification,
    useSound: boolean,
  ) {
    const payload = this.#constructTournamentPnPayload(
      tournamentInfo,
      useSound,
    );
    await this.#sendPushNotification(payload);
  }

  async sendPushNotification(
    externalId: string,
    title: string,
    content: string,
    deepLink: string,
  ) {
    const payload = this.#constructPayload(
      externalId,
      title,
      content,
      deepLink,
    );
    await this.#sendPushNotification(payload);
  }

  async sendMassPushNotification(
    externalIds: string[],
    title: string,
    content: string,
    deepLink: string,
  ) {
    const { appId } = config.notification.oneSignal;
    const { normal } = config.notification.customSounds;
    const payload = {
      app_id: appId,
      contents: {
        en: content,
      },
      headings: {
        en: title,
      },
      include_subscription_ids: [...externalIds],
      url: deepLink,
      target_channel: 'push',
      android_channel_id: normal.customChannelId,
      ios_sound: normal.iosCustomSound,
    };
    await this.#sendPushNotification(payload);
  }

  #constructTournamentPnPayload(
    tournamentInfo: TournamentInfoForPushNotification,
    useSound: boolean,
  ) {
    console.log({ useSound });
    const { id, name, startAt, users } = tournamentInfo;
    const notificationTitle = `${name}`;
    const notificationMessage = `${name} will start at ${convertUtcToIst(
      startAt,
    )}`;
    const oneSignalIds = users.map(({ id }) => id);
    const { appId } = config.notification.oneSignal;
    const { tournament } = config.notification.customSounds;

    return {
      app_id: appId,
      contents: {
        en: notificationMessage,
      },
      headings: {
        en: notificationTitle,
      },
      include_subscription_ids: oneSignalIds,
      url: `emp://Ludo/Tournament/ID=${id}`,
      target_channel: 'push',
      android_channel_id: useSound ? tournament.customChannelId : undefined,
      ios_sound: useSound ? tournament.iosCustomSound : 'nil',
    };
  }

  async #sendPushNotification(payload: any) {
    const { baseUrl, authToken } = config.notification.oneSignal;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };
    try {
      await this.httpClientService.post(baseUrl, payload, {
        headers,
      });
    } catch (error) {
      console.log({ payload, error });
    }
  }

  #constructPayload(
    externalId: string,
    title: string,
    content: string,
    deepLink: string,
  ) {
    const { appId } = config.notification.oneSignal;
    const { normal } = config.notification.customSounds;

    return {
      app_id: appId,
      contents: {
        en: content,
      },
      headings: {
        en: title,
      },
      include_subscription_ids: [externalId],
      url: deepLink,
      target_channel: 'push',
      android_channel_id: normal.customChannelId,
      ios_sound: normal.iosCustomSound,
    };
  }
}
