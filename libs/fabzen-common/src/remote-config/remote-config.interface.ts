import { ReTableType } from 'apps/re-gameplay/src/re-gameplay.types';
import { Games, TableType, Wallet } from '../types';
import { Gateway } from '../types/payment.types';
import {
  CbrGameTableInfo,
  Commissions,
  GstConfig,
  TaxConfig,
  PayoutLimit,
  FreeVersionPayoutLimit,
  SLGameTableInfo,
  SlGameDurationInfo,
  SlGameBoardInfo,
  SLGameFeatures,
  MatchMakingConfig,
} from './remote-config.types';

export abstract class RemoteConfigService {
  // Common
  abstract getRestrictedStates(): string[];
  abstract getPaymentGatewayNameForDeposit(): Gateway;
  abstract getPaymentGatewayNameForPayout(): Gateway;
  abstract getKycLimit(): number;
  abstract getSignupBonus(): Wallet;
  abstract getPayoutLimit(): PayoutLimit;
  abstract getFreeVersionPayoutLimit(): FreeVersionPayoutLimit;
  abstract isNameVerificationForPayoutEnabled(): boolean;
  abstract getPayoutAccountVerificationCharges(): string;
  abstract getCommissions(): Commissions;
  abstract getMaintenance(): boolean;
  abstract getReferralBonus(): string;
  abstract getGstStatuses(): GstConfig;
  abstract getTaxStatuses(): TaxConfig;
  abstract getReferralCommission(): string;
  abstract getFreeGameDailyLimit(): number;
  abstract getWinningsToPro(): number;
  abstract getGameConfigFileUrl(game: Games): string;

  // Rummy Empire
  abstract getReTableInfos(): ReTableType[];
  abstract getReCommissionsByUsers(): Record<string, string>;
  abstract getReMaintenance(): boolean;

  // Skill Patti
  abstract getSpTableInfos(): TableType[];
  abstract getSpCommissionsByUsers(): Record<string, string>;
  abstract getSpMaintenance(): boolean;
  abstract getSpMatchMakingNotificationConfig(): MatchMakingConfig;
  // Callbreak
  abstract getCbrMaintenance(): boolean;
  abstract getCbrTables(): CbrGameTableInfo[];
  abstract getCbrMatchMakingNotificationConfig(): MatchMakingConfig;

  // SLGame
  abstract getSLGameMaintenance(): boolean;
  abstract getSLGameFeatures(): SLGameFeatures;
  abstract getSLGameTables(): SLGameTableInfo[];
  abstract getSLGameTableInfoByType(tableTypeId: string): SLGameTableInfo;
  abstract getSLGameDuration(): SlGameDurationInfo;
  abstract getSLGameBoard(): SlGameBoardInfo;
  abstract getSLMatchMakingNotificationConfig(): MatchMakingConfig;
}

export const createMockRemoteConfigService = (): RemoteConfigService => ({
  getGameConfigFileUrl: jest.fn(),
  getRestrictedStates: jest.fn(),
  getPaymentGatewayNameForDeposit: jest.fn(),
  getSpTableInfos: jest.fn(),
  getCommissions: jest.fn(),
  getSpCommissionsByUsers: jest.fn(),
  getPayoutLimit: jest.fn(),
  getKycLimit: jest.fn(),
  getPaymentGatewayNameForPayout: jest.fn(),
  isNameVerificationForPayoutEnabled: jest.fn(),
  getPayoutAccountVerificationCharges: jest.fn(),
  getSignupBonus: jest.fn(),
  getReferralBonus: jest.fn(),
  getMaintenance: jest.fn(),
  getSpMaintenance: jest.fn(),
  getReTableInfos: jest.fn(),
  getReCommissionsByUsers: jest.fn(),
  getReMaintenance: jest.fn(),
  getCbrMaintenance: jest.fn(),
  getCbrTables: jest.fn(),
  getCbrMatchMakingNotificationConfig: jest.fn(),
  getGstStatuses: jest.fn(),
  getTaxStatuses: jest.fn(),
  getReferralCommission: jest.fn(),
  getFreeGameDailyLimit: jest.fn(),
  getWinningsToPro: jest.fn(),
  getFreeVersionPayoutLimit: jest.fn(),
  getSLGameTables: jest.fn(),
  getSLGameTableInfoByType: jest.fn(),
  getSLGameMaintenance: jest.fn(),
  getSLGameDuration: jest.fn(),
  getSLGameBoard: jest.fn(),
  getSLGameFeatures: jest.fn(),
  getSLMatchMakingNotificationConfig: jest.fn(),
  getSpMatchMakingNotificationConfig: jest.fn(),
});
