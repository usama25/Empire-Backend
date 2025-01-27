export abstract class NotificationGateway {
  abstract sendPushNotification(
    userIds: string[],
    title: string,
    content: string,
    deepLink: string,
  ): Promise<void>;

  abstract sendSocketNotification(
    userIds: string[],
    deepLink: string,
  ): Promise<void>;
}
