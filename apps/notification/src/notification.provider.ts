import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds, MobileNumber } from '@lib/fabzen-common/types';

export class NotificationProvider extends MicroserviceProvider {
  async sendOtp(
    mobileNumber: MobileNumber,
    otp: string,
    isPlayStoreBuild: boolean,
    isGlobalBuild: boolean,
  ) {
    await this._sendRequest(TransporterCmds.SEND_OTP, {
      mobileNumber,
      otp,
      isPlayStoreBuild,
      isGlobalBuild,
    });
  }

  async sendDownloadLinkSms(mobileNumber: MobileNumber) {
    await this._sendRequest(TransporterCmds.SEND_DOWNLOAD_LINK_SMS, {
      mobileNumber,
    });
  }

  sendInAppEvent(
    userId: string,
    eventName: string,
    eventValue?: string | undefined,
  ) {
    this._sendRequest(TransporterCmds.SEND_APPSFLYER_EVENT, {
      userId,
      eventName,
      eventValue,
    });
  }

  sendTournamentNotification(tournamentId: string, index: number) {
    this._sendRequest(TransporterCmds.SEND_LUDO_TOURNAMENT_NOTIFICATION, {
      tournamentId,
      index,
    });
  }

  sendPushNotification(
    userId: string,
    title: string,
    content: string,
    deepLink: string,
  ) {
    this._sendRequest(TransporterCmds.SEND_PUSH_NOTIFICATION, {
      userId,
      title,
      content,
      deepLink,
    });
  }

  async sendMassPushNotifications(
    userIds: string[],
    title: string,
    content: string,
    deepLink: string,
  ) {
    await this._sendRequest(TransporterCmds.SEND_MASS_PUSH_NOTIFICATION, {
      userIds,
      title,
      content,
      deepLink,
    });
  }
}
