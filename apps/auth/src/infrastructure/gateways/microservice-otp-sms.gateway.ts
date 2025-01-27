/* eslint-disable unicorn/prevent-abbreviations */

import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { MobileNumber, TransporterProviders } from '@lib/fabzen-common/types';

import { NotificationProvider } from 'apps/notification/src/notification.provider';
import { OtpSmsService } from 'apps/notification/src/domain/interfaces';

@Injectable()
export class MicroserviceOtpSmsService implements OtpSmsService {
  private readonly notificationProvider: NotificationProvider;
  constructor(
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
  ) {
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );
  }

  async sendOtp(
    mobileNumber: MobileNumber,
    otp: string,
    isPlayStoreBuild: boolean,
    isGlobalBuild: boolean,
  ) {
    await this.notificationProvider.sendOtp(
      mobileNumber,
      otp,
      isPlayStoreBuild,
      isGlobalBuild,
    );
  }

  async sendDownloadLinkSms(mobileNumber: MobileNumber): Promise<void> {
    await this.notificationProvider.sendDownloadLinkSms(mobileNumber);
  }
}
