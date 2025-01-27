import { UserID } from '@lib/fabzen-common/types';

export abstract class WalletServiceGateway {
  abstract debitAviatorBetAmount(
    roundNo: number,
    userId: UserID,
    amount: string,
  ): Promise<void>;
  abstract creditAviatorWinningAmount(
    roundNo: number,
    userId: UserID,
    amount: string,
  ): Promise<void>;
}

export const createMockWalletRepository = (): WalletServiceGateway => ({
  debitAviatorBetAmount: jest.fn(),
  creditAviatorWinningAmount: jest.fn(),
});
