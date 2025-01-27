import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import Big from 'big.js';
import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';
import {
  Table,
  CardsDeck,
  GameStatus,
  PlayerId,
  GameCard,
  Card,
} from '../../cbr-gameplay.types';

import { CommonService } from './common.service';
import { RedisTransientDBService } from '../../redis/backend';

@Injectable()
export class TableService {
  readonly logger = new FbzLogger(TableService.name);

  constructor(
    @Inject(forwardRef(() => CommonService))
    private commonService: CommonService,
    private readonly transientDBService: RedisTransientDBService,
  ) {}

  /**
   * Store both Table in Redis
   */
  async storeTable(table: Table): Promise<void> {
    await this.transientDBService.setActiveTable(table);
  }

  /**
   * Get both Table Info and State From Redis
   */
  async getTable(tableId: string): Promise<Table | undefined> {
    return this.transientDBService.getActiveTable(tableId);
  }

  async getTableOrThrowException(tableId: string): Promise<Table> {
    const table = await this.getTable(tableId);
    if (!table) {
      throw new BadRequestException(`Table ${tableId} does not exist`);
    }
    return table;
  }

  // get connected users for reconnection
  async connected(userId: string) {
    const activeTableId =
      await this.transientDBService.getUserActiveTableId(userId);
    if (activeTableId) {
      try {
        const table = await this.getTableOrThrowException(activeTableId);
        return {
          isReconnected: true,
          tableId: activeTableId,
          table,
        };
      } catch {
        return {
          isReconnected: false,
          tableId: activeTableId,
        };
      }
    } else {
      return {
        isReconnected: false,
      };
    }
  }

  handleTableResponse(table: Table, userId: string) {
    const myPlayerId = table.players.find(
      (player) => player.userId === userId,
    )?.playerId;
    if (
      table.gameStatus === GameStatus.roundStarted ||
      table.gameStatus === GameStatus.waiting
    ) {
      return { table, myPlayerId };
    } else {
      let cards: Card[] = [];
      let playableCards: Card[] = [];
      table.players.map((player) => {
        if (player.playerId === myPlayerId) {
          cards = this.commonService.getRemainingCards(table, player.playerId);
          if (!player.currentCard) {
            playableCards = this.commonService.getPossibleCards(
              table,
              myPlayerId as PlayerId,
            );
          }
          delete player.cards;
        } else {
          delete player.cards;
        }
      });
      return { table, playableCards, myPlayerId, cards };
    }
  }

  /**
   * Check if the user has already in process of game
   */
  async checkDoubleJoin(userId: string) {
    const activeTableId =
      await this.transientDBService.getUserActiveTableId(userId);
    return !!activeTableId;
  }

  /**
   * Delete both Table Info and State in Redis
   */
  async removeTable(table: Table) {
    await this.transientDBService.deleteActiveTable(table.tableId);
    await Promise.all(
      table.players.map((player) => {
        if (player.active) {
          this.transientDBService.deleteUserActiveTableId(player.userId);
        }
      }),
    );
  }

  /**
   * Remove Waiting Table
   */
  async removeWaitingTable(table: Table) {
    const { tableType } = table;
    // remove table from redis waiting status
    await this.transientDBService.deleteWaitingTable(tableType);
  }

  getActivePlayers(table: Table) {
    return table.players.filter((player) => player.active);
  }

  getPlayerFromUserId(table: Table, userId: string) {
    const player = table.players.find((player) => player.userId === userId);
    return player;
  }

  getNextPlayer(table: Table) {
    const playerIds = ['PL1', 'PL2', 'PL3', 'PL4'];
    const currentTurnId = table.currentTurn;
    const nextTurnIndex =
      (playerIds.indexOf(currentTurnId) + 1) % playerIds.length;
    return table.players[nextTurnIndex];
  }

  getDealerId(table: Table) {
    const playerIds = ['PL1', 'PL2', 'PL3', 'PL4'];
    const currentTurnId = table.currentTurn;
    const dealerIndex =
      (playerIds.indexOf(currentTurnId) + 3) % playerIds.length;
    return table.players[dealerIndex];
  }

  getCurrentRoundDealer(table: Table): PlayerId {
    const playerIds = ['PL1', 'PL2', 'PL3', 'PL4'];
    const players = table.players;
    let highestScore = '0';
    let playerId: PlayerId = PlayerId.pl1;
    for (const player of players) {
      if (Big(player.roundScore).gt(Big(highestScore))) {
        highestScore = player.roundScore;
        playerId = player.playerId;
      }
    }
    const dealerIndex = (playerIds.indexOf(playerId) + 3) % playerIds.length;

    return table.players[dealerIndex].playerId;
  }

  getNextRoundDealer(table: Table): PlayerId {
    const players = table.players;
    let highestScore = '0';
    let playerId: PlayerId = PlayerId.pl1;
    for (const player of players) {
      if (Big(player.roundScore).gt(Big(highestScore))) {
        highestScore = player.roundScore;
        playerId = player.playerId;
      }
    }
    return playerId;
  }

  getPrevPlayerIndex(table: Table) {
    const activePlayers = this.getActivePlayers(table);
    let previousPlayer: any = {};
    for (let index = 1; index <= activePlayers.length; index++) {
      const player = activePlayers[activePlayers.length - index];
      if (player.playerId < table.currentTurn) {
        previousPlayer = player;
        break;
      }
    }
    if (!previousPlayer.playerId) {
      previousPlayer = activePlayers.at(-1);
    }
    const previousIndex = table.players.findIndex(
      (player) => player.playerId === previousPlayer.playerId,
    ) as number;
    return previousIndex;
  }

  getGameWinners(table: Table) {
    let winners = [];
    const players = table.players;
    let highestScore = table.players[0].totalScore;
    let activeNumber = 0;
    players.map((player) => {
      if (player.active) {
        activeNumber++;
      }
    });
    if (activeNumber === 1) {
      players.map((player) => {
        if (player.active) {
          winners.push(player.playerId);
        }
      });
    } else {
      for (const player of players) {
        if (Big(player.totalScore).gt(Big(highestScore))) {
          winners = [];
          highestScore = player.totalScore;
          winners.push(player.playerId);
        } else if (Big(player.totalScore).eq(Big(highestScore))) {
          winners.push(player.playerId);
        } else {
          continue;
        }
      }
    }
    const amount =
      table.tableType.amount === '0'
        ? Big(table.tableType.winnings).div(winners.length).toString()
        : Big(table.tableType.winnings).div(winners.length).toString();
    return { winners, amount };
  }

  getCurrentPlayerIndex(table: Table) {
    return table.players.findIndex(
      (player) => player.playerId === table.currentTurn,
    );
  }

  async dealCards(table: Table) {
    const numberCardsPerPlayer = 13;
    let dealtCards: any[] = [];
    let flag = false;
    while (!flag) {
      const playerCards: any[] = [];
      let cardsArray: GameCard[] = [];
      const shuffledCards = await this.shuffleCards(CardsDeck);
      for (let index_ = 0; index_ < table.players.length; index_++) {
        for (let index = 0; index < numberCardsPerPlayer; index++) {
          const card = shuffledCards.shift();
          cardsArray.push({
            card,
            thrown: false,
          } as GameCard);
        }
        playerCards.push(cardsArray);
        cardsArray = [];
      }
      flag = await this.checkRule(playerCards);
      if (flag) {
        dealtCards = playerCards;
      }
    }
    table.players.map((player, index) => {
      player.cards = this.commonService.getSortedCards(dealtCards[index]);
    });
    table.gameStatus = GameStatus.dealCards;
    return table;
  }

  async shuffleCards(cards: typeof CardsDeck) {
    const shuffledCards: typeof CardsDeck = [...cards];
    for (let index = shuffledCards.length - 1; index > 0; index--) {
      const index_ = Math.floor(Math.random() * (index + 1));
      [shuffledCards[index], shuffledCards[index_]] = [
        shuffledCards[index_],
        shuffledCards[index],
      ];
    }
    return shuffledCards;
  }

  checkRule(playerCards: any): boolean {
    for (let index = 0; index < 4; index++) {
      const cards = playerCards[index] as GameCard[];
      const suitsSet = new Set<string>();
      for (const card of cards) {
        const cardGroup = this.commonService.getCardGroup(card.card);
        suitsSet.add(cardGroup);
      }
      const hasAllSuits = suitsSet.size === 4;
      if (hasAllSuits) {
        const hasNoCardOver10 = cards.every(
          (card) => this.commonService.getCardNumber(card.card) <= 10,
        );
        if (hasNoCardOver10) {
          return false;
        }
        continue;
      } else {
        return false;
      }
    }
    return true;
  }
}
