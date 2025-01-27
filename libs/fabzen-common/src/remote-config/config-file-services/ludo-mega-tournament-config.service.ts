import { Injectable, Logger } from '@nestjs/common';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { Games } from '@lib/fabzen-common/types';
import { config } from '@lib/fabzen-common/configuration';

import { LudoMegaTournamentRemoteConfigService } from '../interfaces';
import { LudoMegaTournamentConfig } from '../types';
import { RemoteConfigService } from '../remote-config.interface';

@Injectable()
export class LudoMegaTournamentConfigFileService
  implements LudoMegaTournamentRemoteConfigService
{
  private config: LudoMegaTournamentConfig;
  private logger = new Logger(LudoMegaTournamentConfigFileService.name);

  constructor(
    private readonly httpClientService: HttpClientService,
    private readonly egConfigService: RemoteConfigService,
  ) {
    setInterval(() => {
      this.#downloadConfigFile();
    }, config.configFile.configCacheTTLInSeconds * 1000);
  }

  async #downloadConfigFile() {
    try {
      const configFileUrl = this.egConfigService.getGameConfigFileUrl(
        Games.ludoMegaTournament,
      );
      this.config =
        await this.httpClientService.get<LudoMegaTournamentConfig>(
          configFileUrl,
        );
    } catch (error) {
      this.logger.error('Error fetching Ludo Mega Tournament Config');
      this.logger.error(error);
    }
  }

  isUnderMaintenance(): boolean {
    return (
      this.egConfigService.getMaintenance() ||
      Boolean(this.config.underMaintenance)
    );
  }

  isExtraRollAfterSixEnabled(): boolean {
    return this.config.features.isExtraRollAfterSixEnabled;
  }
}
