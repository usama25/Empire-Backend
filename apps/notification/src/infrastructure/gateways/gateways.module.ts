import { Module } from '@nestjs/common';

import { HttpClientModule } from '@lib/fabzen-common/http-client/src';

import {
  MSG91OtpSmsGateway,
  OneSignalPushNotificationGateway,
  AppsFlyerInAppEventGateway,
} from './';
import {
  PushNotificationGateway,
  InAppEventService,
  OtpSmsService,
} from '../../domain/interfaces';

@Module({
  imports: [HttpClientModule],
  providers: [
    {
      provide: OtpSmsService,
      useClass: MSG91OtpSmsGateway,
    },
    {
      provide: PushNotificationGateway,
      useClass: OneSignalPushNotificationGateway,
    },
    {
      provide: InAppEventService,
      useClass: AppsFlyerInAppEventGateway,
    },
  ],
  exports: [OtpSmsService, PushNotificationGateway, InAppEventService],
})
export class GatewaysModule {}
