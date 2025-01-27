import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import {
  LudoMegaTournamentPrize,
  TransporterProviders,
  UserID,
} from '@lib/fabzen-common/types';

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

  async debitLudoMegaTournamentJoinFee(
    userId: UserID,
    amount: string,
    tournamentId: string,
    entryNo: number,
  ) {
    await this.walletProvider.debitLudoMegaTournamentJoinFee(
      userId,
      amount,
      tournamentId,
      entryNo,
    );
  }

  async creditLudoMegaTournamentPrizes(
    tournamentId: string,
    prizes: LudoMegaTournamentPrize[],
  ): Promise<void> {
    await this.walletProvider.creditLudoMegaTournamentPrizes(
      tournamentId,
      prizes,
    );
  }

  async refundTournamentJoinFees(tournamentId: string): Promise<void> {
    await this.walletProvider.refundTournamentJoinFees(tournamentId);
  }
}
