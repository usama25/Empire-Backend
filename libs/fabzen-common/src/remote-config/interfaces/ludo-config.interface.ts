import { MatchMakingConfig } from '../remote-config.types';
import { LudoTableInfo } from '../types';

export abstract class LudoRemoteConfigService {
  abstract isUnderMaintenance(): boolean;
  abstract getTableInfoByTypeId(tableTypeId: string): LudoTableInfo;
  abstract getAllTableInfos(): LudoTableInfo[];
  abstract getGameDuration(playerCount: number): number;
  abstract getMatchMakingConfig(): MatchMakingConfig;
  abstract getTournamentRepeatTime(): number;
  abstract isExtraRollAfterSixEnabled(): boolean;
}
