export abstract class WalletRepository {
  abstract creditSignupBonus(userId: string): Promise<void>;
  abstract expireBonus(userId: string): Promise<void>;
  abstract creditReferralBonus(
    userId: string,
    referredUserId: string,
    amount: string,
  ): Promise<void>;
}

export const createMockWalletRepository = (): WalletRepository => ({
  creditSignupBonus: jest.fn(),
  expireBonus: jest.fn(),
  creditReferralBonus: jest.fn(),
});
