export abstract class NotificationServiceGateway {
  abstract sendPushNotification(
    userIds: string[],
    title: string,
    content: string,
    deepLink: string,
  ): Promise<void>;
}

export const createNotificationServiceGateway =
  (): NotificationServiceGateway => ({
    sendPushNotification: jest.fn(),
  });
