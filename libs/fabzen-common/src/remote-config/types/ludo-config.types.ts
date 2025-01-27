import { GameTypes } from 'apps/ludo-gameplay/src/ludo-gameplay.types';
import { MatchMakingConfig } from '../remote-config.types';

export type LudoConfig = {
  underMaintenance: boolean;
  repeatTournamentTime: number;
  matchMaking: MatchMakingConfig;
  ludoTables: LudoTableInfo[];
  gameplayDurationByUsers: Record<string, number>;
  features: {
    isExtraRollAfterSixEnabled: boolean;
  };
};

export type LudoTableInfo = {
  tableTypeId: string;
  tableType: GameTypes;
  amount: string;
  maxPlayer: number;
  matchingTime: number;
  winnings: string[];
};
