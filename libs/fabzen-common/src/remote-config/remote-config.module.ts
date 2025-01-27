import { Module } from '@nestjs/common';

import { HttpClientModule } from '../http-client/src';
import { ConfigFileService } from './config-file.service';
import { RemoteConfigService } from './remote-config.interface';
import {
  LudoMegaTournamentRemoteConfigService,
  LudoRemoteConfigService,
  EPLRemoteConfigService,
} from './interfaces';
import {
  LudoConfigFileService,
  LudoMegaTournamentConfigFileService,
  EPLConfigFileService,
} from './config-file-services';

@Module({
  imports: [HttpClientModule],
  providers: [
    {
      provide: RemoteConfigService,
      useClass: ConfigFileService,
    },
    {
      provide: LudoRemoteConfigService,
      useClass: LudoConfigFileService,
    },
    {
      provide: EPLRemoteConfigService,
      useClass: EPLConfigFileService,
    },
    {
      provide: LudoMegaTournamentRemoteConfigService,
      useClass: LudoMegaTournamentConfigFileService,
    },
  ],
  exports: [
    RemoteConfigService,
    LudoRemoteConfigService,
    EPLRemoteConfigService,
    LudoMegaTournamentRemoteConfigService,
  ],
})
export class RemoteConfigModule {}
