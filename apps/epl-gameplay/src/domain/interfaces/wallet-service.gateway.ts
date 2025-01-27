import { UserID } from '@lib/fabzen-common/types';

export abstract class WalletServiceGateway {
  abstract checkEPLWalletBalance(
    userId: UserID,
    joinFee: string,
  ): Promise<boolean>;

  abstract debitEPLJoinFee(
    userIds: string[],
    joinFee: string,
    tableId: string,
  ): Promise<void>;
}

export const createMockWalletRepository = (): WalletServiceGateway => ({
  checkEPLWalletBalance: jest.fn(),
  debitEPLJoinFee: jest.fn(),
});
