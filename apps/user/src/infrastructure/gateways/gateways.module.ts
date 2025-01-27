import { Module } from '@nestjs/common';

import { HttpClientModule } from '@lib/fabzen-common/http-client/src';
import { SurepassGateway } from '../../domain/interfaces/';
import { SurepassAPIGateway } from './surepass.gateway';

@Module({
  imports: [HttpClientModule],
  providers: [
    {
      provide: SurepassGateway,
      useClass: SurepassAPIGateway,
    },
  ],
  exports: [SurepassGateway],
})
export class GatewaysModule {}
