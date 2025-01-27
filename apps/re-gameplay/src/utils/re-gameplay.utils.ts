import * as dayjs from 'dayjs';

import { config } from '@lib/fabzen-common/configuration';
import {
  GameTypes,
  Player,
  PlayerId,
  Table,
  TableType,
  UserID,
} from '@lib/fabzen-common/types';
import {
  MaxScore,
  ReCard,
  ReCardsGroup,
  ReGroupState,
  RePlayerId,
  ReTableType,
} from '../re-gameplay.types';
import Big from 'big.js';

/**
 * Get the Player Id from position
 * @example PL2
 */
export function getPlayerId(playerIndex: number): PlayerId {
  return `${config.spGameplay.playerPrefix}${playerIndex}` as PlayerId;
}

export function getRePlayerId(playerIndex: number): RePlayerId {
  return `${config.reGameplay.playerPrefix}${playerIndex}` as RePlayerId;
}

export function getGameConfig(tableType: TableType): any {
  return config.spGameplay.gameTypes.find(
    (value) => value.type === tableType.gameType,
  );
}

export function getReGameConfig(tableType: ReTableType): any {
  return config.reGameplay.gameTypes.find(
    (value) => value.noPlayers === Number(tableType.maxPlayer),
  );
}

export function getPlayerIndex(table: Table, userId: UserID) {
  return table.players.findIndex((player) => player.userId === userId);
}

export function getPlayerIdByUserId(table: Table, userId: UserID): PlayerId {
  const playerIndex = getPlayerIndex(table, userId);
  return table.players[playerIndex].playerId;
}

export function getReadyPlayersNo(table: Table) {
  return table.players.filter((player) => player.active !== undefined).length;
}

export function getNoPlayers(tableType: TableType): number {
  return tableType.gameType === GameTypes.multiplayer ? 6 : 2;
}

export function getReNoPlayers(tableType: ReTableType): number {
  return Number(tableType.maxPlayer);
}

export function getMatchingTimeout(tableType: TableType): number {
  return getGameConfig(tableType)?.matchingTimeout;
}

export function getReMatchingTimeout(tableType: ReTableType): number {
  return getReGameConfig(tableType)?.matchingTimeout;
}

export function getTurnTimeout(): string {
  return dayjs().add(config.spGameplay.turnTimeout, 'second').toISOString();
}

export function getStartTimeout(): string {
  return dayjs().add(config.spGameplay.startTimeout, 'second').toISOString();
}

export function leaveLogs(message: string, info: object) {
  console.log(message, JSON.stringify(info));
}

export function sortCardsByNumber(
  firstCard: string,
  secondCard: string,
): number {
  const firstSubArrays = firstCard.split(',');
  const secondSubArrays = secondCard.split(',');

  return Number(firstSubArrays[1]) - Number(secondSubArrays[1]);
}

export function getCardInfo(card: string): string {
  const cardInfo: string = `${card.split(',')[1]},${card.split(',')[2]}`;
  return cardInfo;
}

export function getEarliestTimer(dates: string[]): string {
  let earliestTime: string = dates[0];

  for (let index = 1; index < dates.length; index++) {
    const currentDate = dayjs(dates[index]);
    if (currentDate.isBefore(dayjs(earliestTime))) {
      earliestTime = dates[index];
    }
  }

  return earliestTime;
}

export function getAmount(score: string, pointValue: string): string {
  const amount = Big(score).mul(Big(pointValue)).toString();
  return amount;
}

export function calculateScore(
  cardsGroupArray: ReCardsGroup[],
  wildCard: string,
  isDecValid: boolean,
): number {
  let totalScore = 0;
  const cdRedJoker: string = ReCard.cdRedJoker;
  const cdBlackJoker: string = ReCard.cdBlackJoker;
  const wildCardInfo: string = getCardInfo(wildCard);

  if (isDecValid) {
    cardsGroupArray.map(({ cards: cardsArray, valid }) => {
      if (!valid) {
        let cards: string[] = [];
        cardsArray.map((card) => {
          const cardInfo = `${card.split(',')[1]},${card.split(',')[2]}`;
          cards.push(cardInfo);
        });

        const idsOfJokerWild: number[] = [];
        for (const [index, card] of cards.entries()) {
          if (card === cdRedJoker || card === cdBlackJoker) {
            idsOfJokerWild.push(index);
          }
          const currentNumber = card.split(',')[1];
          const wildNumber = wildCardInfo.split(',')[1];
          if (currentNumber === wildNumber) {
            idsOfJokerWild.push(index);
          }
        }
        // Remove Joker & Wild Cards from the cards array
        cards = cards.filter((_, index) => !idsOfJokerWild.includes(index));

        cards.map((card) => {
          const cardNumber = card.split(',')[1];

          totalScore +=
            cardNumber === '11' ||
            cardNumber === '12' ||
            cardNumber === '13' ||
            cardNumber === '14'
              ? 10
              : Number(cardNumber);
        });
      }
    });
  } else {
    cardsGroupArray.map(({ cards: cardsArray, groupState, valid }) => {
      if (groupState === ReGroupState.pureSequence && valid) {
        // skip this loop
      } else {
        let cards: string[] = [];
        cardsArray.map((card) => {
          const cardInfo = getCardInfo(card);
          cards.push(cardInfo);
        });

        const idsOfJokerWild: number[] = [];
        for (const [index, card] of cards.entries()) {
          if (card === cdRedJoker || card === cdBlackJoker) {
            idsOfJokerWild.push(index);
          }
          const currentNumber = card.split(',')[1];
          const wildNumber = wildCardInfo.split(',')[1];
          if (currentNumber === wildNumber) {
            idsOfJokerWild.push(index);
          }
        }
        // Remove Joker & Wild Cards from the cards array
        cards = cards.filter((_, index) => !idsOfJokerWild.includes(index));

        cards.map((card) => {
          const cardNumber = card.split(',')[1];

          totalScore +=
            cardNumber === '11' ||
            cardNumber === '12' ||
            cardNumber === '13' ||
            cardNumber === '14'
              ? 10
              : Number(cardNumber);
        });
      }
    });
  }
  // extract suit and number

  if (totalScore > MaxScore) {
    return MaxScore;
  }

  return totalScore;
}

/**
 * Check if the user has already joined the table
 */
export function checkIfUserAlreadyJoined(
  playerList: Player[],
  userId: UserID,
): boolean {
  return playerList.map(({ userId }) => userId).includes(userId);
}
