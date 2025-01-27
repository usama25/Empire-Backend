import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { Games } from '@lib/fabzen-common/types';
import { config } from '@lib/fabzen-common/configuration';

import { LudoRemoteConfigService } from '../interfaces';
import { LudoConfig, LudoTableInfo } from '../types';
import { RemoteConfigService } from '../remote-config.interface';
import { MatchMakingConfig } from '../remote-config.types';

@Injectable()
export class LudoConfigFileService implements LudoRemoteConfigService {
  private config: LudoConfig;
  private logger = new Logger(LudoConfigFileService.name);

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
        Games.ludo,
      );
      this.config = await this.httpClientService.get<LudoConfig>(configFileUrl);
    } catch (error) {
      this.logger.error('Error fetching Ludo Config');
      this.logger.error(error);
    }
  }

  isUnderMaintenance(): boolean {
    return (
      this.egConfigService.getMaintenance() ||
      Boolean(this.config.underMaintenance)
    );
  }

  getAllTableInfos(): LudoTableInfo[] {
    return this.config.ludoTables;
  }

  getTableInfoByTypeId(tableTypeId: string): LudoTableInfo {
    const allTableInfos = this.getAllTableInfos();
    const tableInfoOfTypeId = allTableInfos.find(
      (tableInfo) => tableInfo.tableTypeId === tableTypeId,
    );
    if (!tableInfoOfTypeId) {
      throw new NotFoundException(`No Table Info of ${tableTypeId}`);
    }
    return tableInfoOfTypeId;
  }

  getGameDuration(playerCount: number): number {
    const duration = this.config.gameplayDurationByUsers[String(playerCount)];
    if (!duration) {
      throw new NotFoundException(
        `No Game Duration Info for room size of ${playerCount}`,
      );
    }
    return duration;
  }

  getMatchMakingConfig(): MatchMakingConfig {
    return this.config.matchMaking;
  }

  getTournamentRepeatTime(): number {
    return this.config.repeatTournamentTime;
  }

  isExtraRollAfterSixEnabled(): boolean {
    return this.config.features.isExtraRollAfterSixEnabled;
  }
}
