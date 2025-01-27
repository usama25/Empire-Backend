import { Controller, UseInterceptors } from '@nestjs/common';
import { EventPattern, MessagePattern } from '@nestjs/microservices';

import { MobileNumber, TransporterCmds } from '@lib/fabzen-common/types';
import { EventData, MessageData } from '@lib/fabzen-common/decorators';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';

import { SendOtpRequestDto } from './dto/send-otp.dto';
import { InAppEvent } from './dto/in-app-event.dto';
import {
  OtpSmsUseCases,
  PushNotificationUseCases,
  InAppEventUseCases,
} from '../../domain/use-cases/';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class NotificationTrasporterController {
  constructor(
    private readonly otpSmsUseCases: OtpSmsUseCases,
    private readonly pushNotificationUseCases: PushNotificationUseCases,
    private readonly inAppEventUseCases: InAppEventUseCases,
  ) {}

  @MessagePattern(TransporterCmds.SEND_OTP)
  async sendOtp(
    @MessageData(SendOtpRequestDto) sendOtpRequest: SendOtpRequestDto,
  ) {
    const { mobileNumber, otp, isPlayStoreBuild, isGlobalBuild } =
      sendOtpRequest;
    await this.otpSmsUseCases.sendOtp(
      mobileNumber,
      otp,
      isPlayStoreBuild,
      isGlobalBuild,
    );
  }

  @MessagePattern(TransporterCmds.SEND_DOWNLOAD_LINK_SMS)
  async sendDownloadLinkSms(
    @MessageData() { mobileNumber }: { mobileNumber: MobileNumber },
  ) {
    await this.otpSmsUseCases.sendDownloadLinkSms(mobileNumber);
  }

  @EventPattern(TransporterCmds.SEND_LUDO_TOURNAMENT_NOTIFICATION)
  async sendLudoTournamentNotification(
    @EventData()
    { tournamentId, index }: { tournamentId: string; index: number },
  ) {
    await this.pushNotificationUseCases.sendLudoTournamentNotification(
      tournamentId,
      index,
    );
  }

  @MessagePattern(TransporterCmds.SEND_PUSH_NOTIFICATION)
  async sendPushNotification(
    @MessageData()
    {
      userId,
      title,
      content,
      deepLink,
    }: {
      userId: string;
      title: string;
      content: string;
      deepLink: string;
    },
  ) {
    await this.pushNotificationUseCases.sendPushNotification(
      userId,
      title,
      content,
      deepLink,
    );
  }

  @MessagePattern(TransporterCmds.SEND_MASS_PUSH_NOTIFICATION)
  async sendMassPushNotification(
    @MessageData()
    {
      userIds,
      title,
      content,
      deepLink,
    }: {
      userIds: string[];
      title: string;
      content: string;
      deepLink: string;
    },
  ) {
    await this.pushNotificationUseCases.sendMassPushNotification(
      userIds,
      title,
      content,
      deepLink,
    );
  }

  @MessagePattern(TransporterCmds.SEND_APPSFLYER_EVENT)
  async sendEventRecord(@MessageData(InAppEvent) inAppEvent: InAppEvent) {
    const { userId, eventName, eventValue } = inAppEvent;
    this.inAppEventUseCases.sendEvent(userId, eventName, eventValue);
  }
}
