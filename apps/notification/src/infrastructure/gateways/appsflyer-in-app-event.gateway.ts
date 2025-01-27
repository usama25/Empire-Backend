/* eslint-disable unicorn/prevent-abbreviations */
import { Injectable, Logger } from '@nestjs/common';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { config } from '@lib/fabzen-common/configuration';
import { AppsflyerUrls, Currency } from '@lib/fabzen-common/types';

import { InAppEventIds } from '../../notification.types';
import { InAppEventService } from '../../domain/interfaces';
import {
  AppsflyerEventNames,
  AppsflyerPayload,
} from '@lib/fabzen-common/types/notification.types';

@Injectable()
export class AppsFlyerInAppEventGateway implements InAppEventService {
  private readonly logger = new Logger(AppsFlyerInAppEventGateway.name);

  constructor(private readonly httpClientService: HttpClientService) {}

  async sendEvent(
    ids: InAppEventIds,
    eventName: AppsflyerEventNames,
    eventValue: string | undefined,
  ) {
    this.logger.log(
      `Appsflyer Event Value - ${JSON.stringify(
        ids,
      )}, ${eventName}, ${eventValue}`,
    );

    const { requestUrlForBase, requestUrlForPro } = this.#constructRequestUrl();

    if (this.#shouldSendToBase(eventName)) {
      await this.#sendEventToBase(
        requestUrlForBase,
        ids.base,
        eventName,
        eventValue,
      );
    }

    if (this.#shouldSendToPro(eventName)) {
      await this.#sendEventToPro(
        requestUrlForPro,
        ids.pro,
        eventName,
        eventValue,
      );
    }
  }

  #shouldSendToPro(eventName: AppsflyerEventNames): boolean {
    return eventName !== AppsflyerEventNames.convertedToPro;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  #shouldSendToBase(eventName: AppsflyerEventNames): boolean {
    return true;
  }

  async #sendEventToBase(
    requestUrlForBase: string,
    id: string | undefined,
    eventName: AppsflyerEventNames,
    eventValue: string | undefined,
  ) {
    if (!id) {
      return;
    }
    const payload: AppsflyerPayload = {
      appsflyer_id: id,
      eventName,
      eventValue,
      eventCurrency: Currency.INR,
    };

    const headers = {
      accept: 'application/json',
      'Content-Type': 'application/json',
      authentication: config.notification.appsflyer.playstoreDevkey,
    };

    await this.#requestToAppsFlyer(requestUrlForBase, payload, headers);
  }

  async #sendEventToPro(
    requestUrl: string,
    id: string | undefined,
    eventName: AppsflyerEventNames,
    eventValue: string | undefined,
  ) {
    if (!id) {
      return;
    }
    const payload: AppsflyerPayload = {
      appsflyer_id: id,
      eventName,
      eventValue,
      eventCurrency: Currency.INR,
    };

    const headers = {
      accept: 'application/json',
      'Content-Type': 'application/json',
      authentication: config.notification.appsflyer.proDevkey,
    };

    await this.#requestToAppsFlyer(requestUrl, payload, headers);
  }

  #constructRequestUrl(): AppsflyerUrls {
    const { baseUrl, playstorePackageName, proPackageName } =
      config.notification.appsflyer;

    const requestUrlForBase = `${baseUrl}/${playstorePackageName}`;
    const requestUrlForPro = `${baseUrl}/${proPackageName}`;

    return { requestUrlForBase, requestUrlForPro };
  }

  async #requestToAppsFlyer(
    requestUrl: string,
    payload: AppsflyerPayload,
    headers: Record<string, string>,
  ) {
    try {
      await this.httpClientService.post(requestUrl, payload, {
        headers,
      });
    } catch (error) {
      this.logger.error(`AppsFlyer Error ${requestUrl}`);
      this.logger.error(error);
    }
  }
}
