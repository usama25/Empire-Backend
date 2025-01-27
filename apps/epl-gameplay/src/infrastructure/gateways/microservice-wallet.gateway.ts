import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { TransporterProviders } from '@lib/fabzen-common/types';

import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { WalletServiceGateway } from '../../domain/interfaces/wallet-service.gateway';

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

  async checkEPLWalletBalance(userId: string, joinFee: string): Promise<any> {
    await this.walletProvider.checkEPLWalletBalance(userId, joinFee);
  }

  async debitEPLJoinFee(
    userIds: string[],
    joinFee: string,
    tableId: string,
  ): Promise<void> {
    await this.walletProvider.debitEPLJoinFee(userIds, joinFee, tableId);
  }
}
