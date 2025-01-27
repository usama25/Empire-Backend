import { LudoMegaTournamentPrize, UserID } from '@lib/fabzen-common/types';

export abstract class WalletServiceGateway {
  abstract debitLudoMegaTournamentJoinFee(
    userId: UserID,
    amount: string,
    tournamentId: string,
    entryNo: number,
  ): Promise<void>;

  abstract creditLudoMegaTournamentPrizes(
    tournamentId: string,
    prizes: LudoMegaTournamentPrize[],
  ): Promise<void>;

  abstract refundTournamentJoinFees(tournamentId: string): Promise<void>;
}

export const createMockWalletRepository = (): WalletServiceGateway => ({
  debitLudoMegaTournamentJoinFee: jest.fn(),
  creditLudoMegaTournamentPrizes: jest.fn(),
  refundTournamentJoinFees: jest.fn(),
});
