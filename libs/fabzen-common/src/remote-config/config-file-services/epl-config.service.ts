import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { Games } from '@lib/fabzen-common/types';

import { EPLRemoteConfigService } from '../interfaces';
import { RemoteConfigService } from '../remote-config.interface';
import {
  EPLConfig,
  EPLGameFeatures,
  EPLGameTableInfo,
  EPLGameDurationInfo,
} from '../types';
import { config } from '@lib/fabzen-common/configuration/configuration';

@Injectable()
export class EPLConfigFileService implements EPLRemoteConfigService {
  private config: EPLConfig;
  private logger = new Logger(EPLConfigFileService.name);

  constructor(
    private readonly httpClientService: HttpClientService,
    private readonly egConfigService: RemoteConfigService,
  ) {
    setInterval(() => {
      this.#downloadConfigFile();
    }, config.configFile.configCacheTTLInSeconds * 1000);
  }

  getEPLGameMaintenance(): boolean {
    return (
      this.egConfigService.getMaintenance() ||
      Boolean(this.config.underMaintenance)
    );
  }

  getEPLGameTables(): EPLGameTableInfo[] {
    return this.config.tables;
  }

  getEPLFeatures(): EPLGameFeatures {
    return this.config.features;
  }

  getEPLGameTableInfoByTableTypeId(tableTypeId: string): EPLGameTableInfo {
    const allTables = this.getEPLGameTables();
    const eplTable = allTables.find(
      (table) => table.tableTypeId === tableTypeId,
    );
    if (!eplTable) {
      throw new BadRequestException(
        `No Table Type available with id ${tableTypeId}`,
      );
    }
    return eplTable;
  }

  getEPLGameDuration(): EPLGameDurationInfo {
    return this.config.gameplayDurationByUsers;
  }

  async #downloadConfigFile() {
    try {
      const configFileUrl = this.egConfigService.getGameConfigFileUrl(
        Games.epl,
      );
      if (!configFileUrl) {
        return;
      }
      this.config = await this.httpClientService.get<EPLConfig>(configFileUrl);
    } catch (error) {
      this.logger.error('Error fetching EPL Config');
      this.logger.error(error);
    }
  }

  isUnderMaintenance(): boolean {
    return (
      this.egConfigService.getMaintenance() ||
      Boolean(this.config.underMaintenance)
    );
  }
}
