import { DynamicModule, Module } from '@nestjs/common';

import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

import { GatewaysModule } from '../../infrastructure/gateways';
import { OtpSmsUseCases } from './otp-sms.use-cases';
import { PushNotificationUseCases } from './push-notification.use-cases';
import { InAppEventUseCases } from './in-app-event.use-cases';

@Module({})
export class UsecasesModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: UsecasesModule,
      imports: [
        GatewaysModule,
        RemoteConfigModule,
        MongooseModule.forRoot(mongoUri),
      ],
      providers: [OtpSmsUseCases, PushNotificationUseCases, InAppEventUseCases],
      exports: [OtpSmsUseCases, PushNotificationUseCases, InAppEventUseCases],
    };
  }
}
