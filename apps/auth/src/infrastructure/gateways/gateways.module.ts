import { Module } from '@nestjs/common';

import { HttpClientModule } from '@lib/fabzen-common/http-client/src';

import { OtpSmsService } from 'apps/notification/src/domain/interfaces';
import { IpRegionResolver } from '../../domain/interfaces/';
import { IpApiIpRegionResolver, MicroserviceOtpSmsService } from './';

@Module({
  imports: [HttpClientModule],
  providers: [
    {
      provide: IpRegionResolver,
      useClass: IpApiIpRegionResolver,
    },
    {
      provide: OtpSmsService,
      useClass: MicroserviceOtpSmsService,
    },
  ],
  exports: [IpRegionResolver, OtpSmsService],
})
export class GatewaysModule {}
