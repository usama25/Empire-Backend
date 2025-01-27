import {
  EPLGameTableInfo,
  EPLGameDurationInfo,
  EPLGameFeatures,
} from '../types';

export abstract class EPLRemoteConfigService {
  abstract getEPLGameMaintenance(): boolean;
  abstract getEPLGameTables(): EPLGameTableInfo[];
  abstract getEPLGameTableInfoByTableTypeId(
    tableTypeId: string,
  ): EPLGameTableInfo;
  abstract getEPLGameDuration(): EPLGameDurationInfo;
  abstract isUnderMaintenance(): boolean;
  abstract getEPLFeatures(): EPLGameFeatures;
}
