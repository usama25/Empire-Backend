import { GameTypes } from 'apps/ludo-gameplay/src/ludo-gameplay.types';
import { Games, Gateway, TableType, Wallet } from '../types';
import { ReTableType } from 'apps/re-gameplay/src/re-gameplay.types';

export type MainConfig = {
  underMaintenance: boolean;
  restrictedStates: string[];
  games: GameConfig[];
  commissions: Commissions;
  bonuses: {
    referralBonus: string;
    signupBonus: Wallet;
  };
  payments: {
    depositGateway: Gateway;
    withdrawGateway: Gateway;
    isGstDeductionEnabled: boolean;
    isGstCashbackEnabled: boolean;
    isTaxDeductionEnabled: boolean;
    isTaxCashbackEnabled: boolean;
    isNameVerificationEnabled: boolean;
    accountVerificationCharges: string;
  };
  limits: PayoutLimit;
  freeGames: {
    allowedGamesPerDay: number;
    winningsToPro: string;
    upiWithdrawalLimit: string;
    bankWithdrawalLimit: string;
    maxLifetimeWithdrawalLimit: string;
    maxWithdrawalsPerDay: string;
  };
};

export type Commissions = {
  bonusCommission: string;
  referralCommission: string;
  discrepancyCommission: string;
  conversionCommission: string;
};

export type GstConfig = {
  isGstDeduction: boolean;
  isGstCashback: boolean;
};

export type TaxConfig = {
  isTaxDeductionEnabled: boolean;
  isTaxCashbackEnabled: boolean;
};

export type GameConfig = {
  id: Games;
  name: string;
  status: string;
  category: string;
  config: string;
  banner: Banner;
  countries: string[];
};

export type Banner = {
  name: string;
  type: string;
  color: string;
  downloadLink: string;
  goToUrl: string;
};

export type ReConfig = {
  tables: ReTableType[];
  gameCommissionByUsers: Record<string, string>;
  underMaintenance: boolean;
};

export type SpConfig = {
  tables: TableType[];
  commissions: {
    gameCommissionByUsers: Record<string, string>;
  };
  underMaintenance: boolean;
  matchMakingNotifications: MatchMakingConfig;
};

export type CbrConfig = {
  tables: CbrGameTableInfo[];
  underMaintenance: boolean;
  matchMaking: MatchMakingConfig;
};

export type LudoMegaTournamentConfig = {
  underMaintenance: boolean;
};

export type SpGameTableInfo = {
  initialBetAmount: string;
  minJoinAmount: string;
  potLimit: string;
  gameType: GameTypes;
  tableTypeId: string;
};

export type RemoteConfig = {
  underMaintenance: boolean;
  restrictedStates: string[];
  bonuses: {
    referralBonus: string;
    signupBonus: Wallet;
  };
};

export type PayoutLimit = {
  autoTransferLimit: string;
  upiWithdrawalLimit: string;
  bankWithdrawalLimit: string;
  kycWithdrawalLimit: string;
  maxWithdrawalsPerDay: string;
  kycLimitPerDocument: string;
  taxFreeWithdrawalLimit: string;
};

export type FreeVersionPayoutLimit = {
  upiWithdrawalLimit: string;
  bankWithdrawalLimit: string;
  maxLifetimeWithdrawalLimit: string;
  maxWithdrawalsPerDay: string;
};

export type CbrGameTableInfo = {
  amount: string;
  winnings: string;
  totalRounds: number;
  tableTypeId: string;
};

export type SLConfig = {
  tables: SLGameTableInfo[];
  underMaintenance: boolean;
  gameplayDurationByUsers: SlGameDurationInfo;
  board: SlGameBoardInfo;
  matchMaking: MatchMakingConfig;
  features: SLGameFeatures;
};

export type SLGameTableInfo = {
  amount: string;
  winnings: [];
  tableTypeId: string;
  maxPlayer: number;
  matchingTime: number;
};

export type SLGameFeatures = {
  playAgainTimer: number;
  turnTimer: number;
};

export type SlGameDurationInfo = Record<number, number>;

export type SlGameBoardInfo = {
  snakes: number[][];
  ladders: number[][];
};

export type LudoGameModes = {
  classicTwoPlayerMode: boolean;
  classicFourPlayerMode: boolean;
  quickTwoPlayerMode: boolean;
  quickFourPlayerMode: boolean;
  furiousFourPlayerMode: boolean;
  tournamentMode: boolean;
};

export type TargetPawns = {
  twoPlayer: {
    quick: number;
    classic: number;
  };
  fourPlayer: {
    quick: number;
    classic: number;
  };
};

export type MatchingTime = {
  min: number;
  max: number;
  time: number;
};

export type Commission = {
  game: number;
  tableFee: TableFee;
};

export type TableFee = {
  twoPlayer: any;
  threePlayer: any;
  fourPlayer: any;
};

export type MatchMakingConfig = {
  isIPRestrictionEnabled: boolean;
  isGeolocationRestrictionEnabled: boolean;
  isPushNotificationsEnabled: boolean;
  isSocketNotificationsEnabled: boolean;
  minimumJoinAmountForNotifications: string;
};
