import { TournamentInfoForPushNotification } from '../../notification.types';

export abstract class PushNotificationGateway {
  abstract sendPushNotificationForLudoTournament(
    tournamentInfo: TournamentInfoForPushNotification,
    useSound: boolean,
  ): Promise<void>;

  abstract sendPushNotification(
    externalId: string,
    title: string,
    content: string,
    deepLink: string,
  ): Promise<void>;

  abstract sendMassPushNotification(
    externalIds: string[],
    title: string,
    content: string,
    deepLink: string,
  ): Promise<void>;
}

export const createMockPushNotificationService =
  (): PushNotificationGateway => ({
    sendPushNotificationForLudoTournament: jest.fn(),
    sendPushNotification: jest.fn(),
    sendMassPushNotification: jest.fn(),
  });
