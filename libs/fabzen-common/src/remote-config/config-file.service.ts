/* istanbul ignore file */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';

import {
  CbrConfig,
  CbrGameTableInfo,
  Commissions,
  MainConfig,
  SpConfig,
  PayoutLimit,
  GstConfig,
  TaxConfig,
  FreeVersionPayoutLimit,
  SLGameTableInfo,
  SLConfig,
  SlGameDurationInfo,
  MatchMakingConfig,
  LudoMegaTournamentConfig,
  SlGameBoardInfo,
  ReConfig,
  SLGameFeatures,
} from './remote-config.types';
import { Games, Gateway, TableType, Wallet } from '../types';
import { RemoteConfigService } from './remote-config.interface';
import { HttpClientService } from '../http-client/src';
import { FbzLogger } from '../utils/logger.util';
import { isEmpty } from 'lodash';
import { ReTableType } from 'apps/re-gameplay/src/re-gameplay.types';

@Injectable()
export class ConfigFileService implements RemoteConfigService {
  private logger = new FbzLogger(ConfigFileService.name);

  private mainConfig: MainConfig = config.jest.mainConfig;
  private reConfig: ReConfig;
  private spConfig: SpConfig;
  private cbrConfig: CbrConfig;
  private slConfig: SLConfig;
  private ludoMegaTournamentConfig: LudoMegaTournamentConfig;

  constructor(private readonly httpClientService: HttpClientService) {
    setInterval(() => {
      this.#downloadAllConfigFiles();
    }, config.configFile.configCacheTTLInSeconds * 1000);
  }

  getGameConfigFileUrl(game: Games): string {
    const gameConfig = (this.mainConfig.games ?? []).find(
      (config) => config.id === game,
    );
    if (!gameConfig) {
      throw new NotFoundException(`Config File Url not found for ${game}`);
    }
    return gameConfig.config;
  }

  async #downloadAllConfigFiles() {
    try {
      const downloadedConfig = await this.#downloadConfigFile<MainConfig>(
        config.configFile.url,
      );
      if (!isEmpty(downloadedConfig)) {
        this.mainConfig = downloadedConfig;
      }
    } catch {
      this.logger.error('Error fetching Main Config');
    }
    if (this.mainConfig.games) {
      await this.#downloadGameConfigFiles();
    }
  }

  async #downloadConfigFile<T>(url: string): Promise<T> {
    return await this.httpClientService.get<T>(url);
  }

  async #downloadGameConfigFiles() {
    for (const { id, config } of this.mainConfig.games) {
      switch (id) {
        case Games.skillpatti: {
          try {
            this.spConfig = await this.#downloadConfigFile<SpConfig>(config);
          } catch (error) {
            this.logger.error('Error fetching SP Config');
            this.logger.error(error);
          }

          break;
        }
        case Games.rummyempire: {
          try {
            this.reConfig = await this.#downloadConfigFile<ReConfig>(config);
          } catch (error) {
            this.logger.error('Error fetching RE Config');
            this.logger.error(error);
          }

          break;
        }
        case Games.callbreak: {
          try {
            this.cbrConfig = await this.#downloadConfigFile<CbrConfig>(config);
          } catch (error) {
            this.logger.error('Error fetching CBR Config');
            this.logger.error(error);
          }

          break;
        }
        case Games.snakeAndLadders: {
          try {
            this.slConfig = await this.#downloadConfigFile<SLConfig>(config);
          } catch (error) {
            this.logger.error('Error fetching SL Config');
            this.logger.error(error);
          }
          break;
        }
        case Games.ludoMegaTournament: {
          try {
            this.ludoMegaTournamentConfig =
              await this.#downloadConfigFile<LudoMegaTournamentConfig>(config);
          } catch (error) {
            this.logger.error('Error fetching Mega Tournament Config');
            this.logger.error(error);
          }

          break;
        }
        // No default
      }
    }
  }

  // Common

  getRestrictedStates(): string[] {
    return this.mainConfig.restrictedStates ?? [];
  }

  getPaymentGatewayNameForDeposit(): Gateway {
    return this.mainConfig.payments.depositGateway;
  }

  getCommissions(): Commissions {
    return this.mainConfig.commissions;
  }

  getPaymentGatewayNameForPayout(): Gateway {
    return this.mainConfig.payments.withdrawGateway;
  }

  getMaintenance(): boolean {
    return this.mainConfig.underMaintenance;
  }

  getPayoutLimit(): PayoutLimit {
    return this.mainConfig.limits;
  }

  getFreeVersionPayoutLimit(): FreeVersionPayoutLimit {
    return this.mainConfig.freeGames;
  }

  getKycLimit(): number {
    return Number(this.mainConfig.limits.kycLimitPerDocument);
  }

  getSignupBonus(): Wallet {
    return this.mainConfig.bonuses.signupBonus;
  }

  getReferralBonus(): string {
    return this.mainConfig.bonuses.referralBonus;
  }

  getFreeGameDailyLimit(): number {
    return Number(this.mainConfig.freeGames.allowedGamesPerDay);
  }

  getWinningsToPro(): number {
    return Number(this.mainConfig.freeGames.winningsToPro);
  }

  isNameVerificationForPayoutEnabled(): boolean {
    return this.mainConfig.payments.isNameVerificationEnabled;
  }

  getPayoutAccountVerificationCharges(): string {
    return this.mainConfig.payments.accountVerificationCharges;
  }

  // Rummy Empire
  getReMaintenance(): boolean {
    return this.mainConfig.underMaintenance || this.reConfig.underMaintenance;
  }

  getReTableInfos(): ReTableType[] {
    return this.reConfig.tables;
  }

  getReCommissionsByUsers(): Record<string, string> {
    return this.reConfig.gameCommissionByUsers;
  }

  // Skill Patti

  getSpMaintenance(): boolean {
    return this.mainConfig.underMaintenance || this.spConfig.underMaintenance;
  }

  getSpTableInfos(): TableType[] {
    return this.spConfig.tables;
  }

  getSpCommissionsByUsers(): Record<string, string> {
    return this.spConfig.commissions.gameCommissionByUsers;
  }

  getSpMatchMakingNotificationConfig(): MatchMakingConfig {
    return this.spConfig.matchMakingNotifications;
  }

  // Callbreak

  getCbrMaintenance(): boolean {
    return this.mainConfig.underMaintenance || this.cbrConfig.underMaintenance;
  }

  getCbrTables(): CbrGameTableInfo[] {
    return this.cbrConfig.tables;
  }

  getCbrMatchMakingNotificationConfig(): MatchMakingConfig {
    return this.cbrConfig.matchMaking;
  }

  getGstStatuses(): GstConfig {
    return {
      isGstDeduction: this.mainConfig.payments.isGstDeductionEnabled,
      isGstCashback: this.mainConfig.payments.isGstCashbackEnabled,
    };
  }

  getTaxStatuses(): TaxConfig {
    return {
      isTaxDeductionEnabled: this.mainConfig.payments.isTaxDeductionEnabled,
      isTaxCashbackEnabled: this.mainConfig.payments.isTaxCashbackEnabled,
    };
  }

  getReferralCommission(): string {
    return this.mainConfig.commissions.referralCommission;
  }

  // SLGame

  getSLGameMaintenance(): boolean {
    return this.mainConfig.underMaintenance || this.slConfig.underMaintenance;
  }

  getSLGameTables(): SLGameTableInfo[] {
    return this.slConfig.tables;
  }

  getSLGameFeatures(): SLGameFeatures {
    return this.slConfig.features;
  }

  getSLGameTableInfoByType(tableTypeId: string): SLGameTableInfo {
    const allTables = this.getSLGameTables();
    const slTable = allTables.find(
      (table) => table.tableTypeId === tableTypeId,
    );
    if (!slTable) {
      throw new BadRequestException(`No Table Type with id ${tableTypeId}`);
    }
    return slTable;
  }

  getSLGameDuration(): SlGameDurationInfo {
    return this.slConfig.gameplayDurationByUsers;
  }

  getSLGameBoard(): SlGameBoardInfo {
    return this.slConfig.board;
  }

  getSLMatchMakingNotificationConfig(): MatchMakingConfig {
    return this.slConfig.matchMaking;
  }

  // Ludo Mega Tournament
  getLudoMegaTournamentMaintenance(): boolean {
    return (
      this.mainConfig.underMaintenance ||
      this.ludoMegaTournamentConfig.underMaintenance
    );
  }
}
