export enum LudoMegaTournamentStatus {
  live = 'live',
  full = 'full', // Some games are ongoing
  closed = 'closed', // Not full, but Time is up
  completed = 'completed', // Completely Finalized
  canceled = 'canceled',
}

export type LudoMegaTournamentWinningPrize = {
  minRank: number;
  maxRank: number;
  percentage: number;
  amount: string;
};

export type LudoMegaTournamentFilterWithPagination = {
  skip: number;
  limit: number;
  sortBy: string;
  sortDir: 1 | -1;
  userId: string;
  isActive: boolean;
  minJoinFee: string;
  maxJoinFee: string;
  winnerCount: string;
};

export type LudoMegaTournamentPrize = {
  userId: string;
  winAmount: string;
  entryNo: number;
};
