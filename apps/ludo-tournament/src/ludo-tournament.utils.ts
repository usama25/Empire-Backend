import Big from 'big.js';
import * as dayjs from 'dayjs';

import { WinningPrize } from './ludo-tournament.types';
import { getRoundDuration } from 'apps/ludo-gameplay/src/utils/ludo-gameplay.utils';
import { config } from '@lib/fabzen-common/configuration';

export function calculateWinAmount(
  winningPrizes: WinningPrize[],
  rank: number,
): string {
  const prize = winningPrizes.find(
    ({ minRank, maxRank }) => rank <= maxRank && rank >= minRank,
  );
  if (!prize) {
    return '0.00';
  }
  return Big(prize.amount).toFixed(2).toString();
}

export function calculateWinnerCount(winningPrizes: WinningPrize[]): number {
  return Math.max(...winningPrizes.map(({ maxRank }) => maxRank));
}

export function calculateTotalAmount(
  joinFee: string,
  maxNoPlayers: number,
  winningPrizes: WinningPrize[],
  registerTill: Date,
): string {
  if (dayjs().isAfter(registerTill)) {
    let sum = Big(0);
    for (const { minRank, maxRank, amount } of winningPrizes) {
      sum = sum.add(Big(amount).mul(maxRank - minRank + 1));
    }
    return sum.toString();
  } else {
    return Big(joinFee).mul(maxNoPlayers).toString();
  }
}

export function calculateTotalRounds(
  playerNumber: number,
  noPlyaersPerGame: number,
) {
  let totalRound = 0;
  while (playerNumber > 1) {
    playerNumber = Math.ceil(playerNumber / noPlyaersPerGame);
    totalRound++;
  }
  return totalRound;
}

export function calculateRoundStartTime(
  tournamentStartTime: string | Date,
  roundNo: number,
  noPlayersPerGame: number,
): string {
  const { duration, unit } = getRoundDuration(noPlayersPerGame);
  let startAt = dayjs(tournamentStartTime);
  const durationOfOneRound = dayjs
    .duration(config.ludoGameplay.tournamentRoundWaitingTime, 'seconds')
    .add(duration, unit as dayjs.ManipulateType)
    .add(config.ludoGameplay.bingoScreenWaitingTime, 'seconds');
  for (let index = 0; index < roundNo - 1; index++) {
    startAt = startAt.add(durationOfOneRound);
  }
  return startAt.toISOString();
}
