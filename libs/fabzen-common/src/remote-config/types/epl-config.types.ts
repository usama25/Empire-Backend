export type EPLConfig = {
  tables: EPLGameTableInfo[];
  underMaintenance: boolean;
  gameplayDurationByUsers: EPLGameDurationInfo;
  features: EPLGameFeatures;
};

export type EPLGameTableInfo = {
  amount: string;
  commissions: string[];
  tableTypeId: string;
  maxPlayer: number;
  matchingTime: number;
  winnings: [];
};

export type EPLGameFeatures = {
  playAgainTimer: number;
  turnTimer: number;
};
export type EPLGameDurationInfo = Record<number, number>;
