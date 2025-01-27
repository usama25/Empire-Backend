import { Module } from '@nestjs/common';
import { WalletRepository } from '../../domain/interfaces';
import { MicroserviceWalletRepository } from './microservice-wallet.repository';

@Module({
  providers: [
    {
      provide: WalletRepository,
      useClass: MicroserviceWalletRepository,
    },
  ],
  exports: [WalletRepository],
})
export class RepositoriesModule {}
