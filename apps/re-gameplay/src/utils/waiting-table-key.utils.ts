import { TableType, Currency } from '@lib/fabzen-common/types';

export function getWaitingTableKey(
  { initialBetAmount, minJoinAmount, potLimit, gameType }: TableType,
  currency: Currency,
) {
  return `${gameType}initialBetAmount${initialBetAmount}minJoinAmount${minJoinAmount}potLimit${potLimit}${currency}`;
}
