import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { TransporterProviders, UserID } from '@lib/fabzen-common/types';

import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { WalletServiceGateway } from '../../domain/interfaces';

@Injectable()
export class MicroserviceWalletServiceGateway implements WalletServiceGateway {
  private readonly logger = new Logger(MicroserviceWalletServiceGateway.name);
  private readonly walletProvider: WalletProvider;

  constructor(
    @Inject(TransporterProviders.WALLET_SERVICE)
    private walletClient: ClientProxy,
  ) {
    this.walletProvider = new WalletProvider(this.walletClient);
  }

  async debitAviatorBetAmount(roundNo: number, userId: UserID, amount: string) {
    await this.walletProvider.debitAviatorBetAmount(roundNo, userId, amount);
  }

  async creditAviatorWinningAmount(
    roundNo: number,
    userId: UserID,
    amount: string,
  ) {
    await this.walletProvider.creditAviatorWinningAmount(
      roundNo,
      userId,
      amount,
    );
  }
}
