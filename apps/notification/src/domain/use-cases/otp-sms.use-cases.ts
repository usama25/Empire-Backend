import { Injectable } from '@nestjs/common';

import { OtpSmsService } from '../interfaces';
import { MobileNumber } from '@lib/fabzen-common/types';

@Injectable()
export class OtpSmsUseCases {
  constructor(private readonly otpSmsService: OtpSmsService) {}

  async sendOtp(
    mobileNumber: MobileNumber,
    otp: string,
    isPlayStoreBuild: boolean,
    isGlobalBuild: boolean,
  ) {
    await this.otpSmsService.sendOtp(
      mobileNumber,
      otp,
      isPlayStoreBuild,
      isGlobalBuild,
    );
  }

  async sendDownloadLinkSms(mobileNumber: MobileNumber) {
    await this.otpSmsService.sendDownloadLinkSms(mobileNumber);
  }
}
