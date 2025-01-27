/* eslint-disable unicorn/prevent-abbreviations */
import { Injectable, Logger } from '@nestjs/common';

import { MobileNumber } from '@lib/fabzen-common/types';
import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { config } from '@lib/fabzen-common/configuration';

import { OtpSmsService } from '../../domain/interfaces';

@Injectable()
export class MSG91OtpSmsGateway implements OtpSmsService {
  private readonly logger = new Logger(MSG91OtpSmsGateway.name);

  constructor(private readonly httpClientService: HttpClientService) {}

  async sendOtp(
    mobileNumber: MobileNumber,
    otp: string,
    isPlayStoreBuild: boolean,
    isGlobalBuild: boolean,
  ) {
    const requestUrl = this.#constructRequestUrl(
      mobileNumber,
      otp,
      isPlayStoreBuild,
      isGlobalBuild,
    );
    await this.#requestToMsg91(requestUrl);
  }

  #constructRequestUrl(
    mobileNumber: MobileNumber,
    otp: string,
    isPlayStoreBuild: boolean,
    isGlobalBuild: boolean,
  ): string {
    const { baseUrl } = config.notification.msg91;
    const templateId = this.#chooseTemplateId(isPlayStoreBuild, isGlobalBuild);
    const { countryCode, number } = mobileNumber;
    return `${baseUrl}/otp?template_id=${templateId}&mobile=${countryCode}${number}&otp=${otp}&otp_length=${otp.length}`;
  }

  async #requestToMsg91(requestUrl: string, data?: any) {
    const { authKey } = config.notification.msg91;
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      authKey,
    };
    try {
      await this.httpClientService.post(
        requestUrl,
        data ?? 'dummy-string-for-msg91',
        {
          headers,
        },
      );
    } catch (error) {
      this.logger.error(`MSG91 Error ${requestUrl}`);
      this.logger.error(error);
    }
  }

  #chooseTemplateId(isPlayStoreBuild: boolean, isGlobalBuild: boolean): string {
    const { global, local } = config.notification.msg91.templateIds;
    if (isGlobalBuild) {
      return isPlayStoreBuild ? global.playstore : global.website;
    } else {
      return isPlayStoreBuild ? local.playstore : local.website;
    }
  }

  async sendDownloadLinkSms(mobileNumber: MobileNumber): Promise<void> {
    const { baseUrl, templateIds } = config.notification.msg91;
    const { countryCode, number } = mobileNumber;

    const requestUrl = `${baseUrl}/flow`;
    const requestData: Record<string, string | Array<{ mobiles: string }>> = {
      template_id: templateIds.downloadLink,
      short_url: '0',
      recipients: [
        {
          mobiles: `${countryCode}${number}`,
        },
      ],
    };
    await this.#requestToMsg91(requestUrl, requestData);
  }
}
