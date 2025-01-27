import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { TransporterProviders } from '@lib/fabzen-common/types';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { WalletRepository } from '../../domain/interfaces';

@Injectable()
export class MicroserviceWalletRepository implements WalletRepository {
  private readonly logger = new Logger(MicroserviceWalletRepository.name);
  private readonly walletProvider: WalletProvider;

  constructor(
    @Inject(TransporterProviders.WALLET_SERVICE)
    private walletClient: ClientProxy,
  ) {
    this.walletProvider = new WalletProvider(walletClient);
  }

  async creditSignupBonus(userId: string) {
    await this.walletProvider.creditSignupBonus(userId);
  }

  async expireBonus(userId: string): Promise<void> {
    await this.walletProvider.expireBonus(userId);
  }

  async creditReferralBonus(
    userId: string,
    referredUserId: string,
    amount: string,
  ): Promise<void> {
    await this.walletProvider.creditReferralBonus(
      userId,
      referredUserId,
      amount,
    );
  }
}
