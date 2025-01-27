import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';
import {
  Table,
  PlayerId,
  Card,
  CardGroup,
  GameCard,
  ScoreBoardData,
  BoardData,
} from '../../cbr-gameplay.types';

import { TableService } from './table.service';
import { RedisTransientDBService } from '../../redis/backend';
// import * as AWS from 'aws-sdk';
import {
  CbrHistoryDto,
  CbrPlayer,
  GameOutcome,
  Games,
  TransporterProviders,
  UserGameDetails,
} from '@lib/fabzen-common/types';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { ClientProxy } from '@nestjs/microservices';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { CbrGameHistoryRepository } from '../../cbr-gameplay.repository';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { UserProvider } from 'apps/user/src/user.provider';

@Injectable()
export class CommonService {
  private readonly logger = new FbzLogger(CommonService.name);
  private readonly walletProvider: WalletProvider;
  private readonly userProvider: UserProvider;

  constructor(
    @Inject(forwardRef(() => TableService)) private tableService: TableService,
    private readonly transientDBService: RedisTransientDBService,
    private readonly userRepository: UserRepository,
    private readonly cbrGameHistoryRepository: CbrGameHistoryRepository,
    @Inject(TransporterProviders.WALLET_SERVICE)
    private walletClient: ClientProxy,
    @Inject(TransporterProviders.USER_SERVICE)
    private userClient: ClientProxy,
  ) {
    this.walletProvider = new WalletProvider(this.walletClient);
    this.userProvider = new UserProvider(this.userClient);
  }

  async checkIfJoined(userId: string) {
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    if (!tableId) {
      return false;
    }
    const table = (await this.transientDBService.getActiveTable(
      tableId,
    )) as Table;
    return table.players.findIndex((player) => player.userId === userId) !== -1;
  }

  // debit joinFee to players who joined the game table.
  async debitTable(userIds: string[], amount: string, tableId: string) {
    this.logger.log({ userIds }, { amount }, { tableId });
    await this.walletProvider.debitCbrJoinFee(userIds, amount, tableId);
  }

  // updated playedFreeGames of Pro users who joined the game table
  async updatePlayedFreeGames(userId: string) {
    await this.userRepository.updatePlayedFreeGames(userId);
  }

  async checkWalletBalance(userId: string, amount: string): Promise<boolean> {
    return await this.walletProvider.checkCbrWalletBalance(userId, amount);
  }

  /**
   * Get Player Details for displaying on the screen
   */
  async attachPlayerDetail(userId: string): Promise<UserGameDetails> {
    return await this.userRepository.getUserGameDetails(
      userId,
      Games.callbreak,
    );
  }

  async addWinningAmount(table: Table) {
    const { winners, amount } = this.tableService.getGameWinners(table);
    const winnerUserIds: string[] = [];
    const gamePlayers: CbrPlayer[] = [];
    const winLoseAmount = Number(amount).toFixed(2);
    table.players.map(async (player) => {
      if (winners.includes(player.playerId)) {
        winnerUserIds.push(player.userId);
        const cbrPlayer: CbrPlayer = {
          userId: toObjectId(player.userId),
          playerId: player.playerId,
          username: player.playerInfo.name || player.playerInfo.username,
          name: player.playerInfo.name,
          winLoseAmount: winLoseAmount,
          outcome: GameOutcome.won,
          avatar: player.playerInfo.avatar,
          totalScore: player.totalScore,
          scores: player.scores,
          active: player.active,
        };
        gamePlayers.push(cbrPlayer);
        await this.userProvider.updateUserStats({
          userId: player.userId,
          winLoseAmount: Number(winLoseAmount),
          outcome: GameOutcome.won,
          game: Games.callbreak,
        });
      } else {
        const cbrPlayer: CbrPlayer = {
          userId: toObjectId(player.userId),
          playerId: player.playerId,
          username: player.playerInfo.name || player.playerInfo.username,
          name: player.playerInfo.name,
          winLoseAmount: table.tableType.amount,
          outcome: GameOutcome.lost,
          avatar: player.playerInfo.avatar,
          totalScore: player.totalScore,
          scores: player.scores,
          active: player.active,
        };

        gamePlayers.push(cbrPlayer);
        await this.userProvider.updateUserStats({
          userId: player.userId,
          winLoseAmount: Number(table.tableType.amount),
          outcome: GameOutcome.lost,
          game: Games.callbreak,
        });
      }
    });
    // struct new game history dto

    const newTableHistory: CbrHistoryDto = {
      tableId: table.tableId,
      joinFee: table.tableType.amount,
      totalRounds: table.tableType.totalRounds,
      startedAt: table.roundStartedAt as Date,
      players: gamePlayers,
    };

    await this.cbrGameHistoryRepository.createCbrHistory(newTableHistory);

    await this.walletProvider.addCbrWinningAmount(
      winnerUserIds,
      amount,
      table.tableId,
    );
  }

  async endStuckTable(table: Table) {
    const amount = table.tableType.amount;
    const winnerUserIds: string[] = [];
    const losers: string[] = [];
    table.players.map((player) => {
      if (player.active) {
        winnerUserIds.push(player.userId);
      } else {
        losers.push(player.userId);
      }
    });
    const scoreboard = await this.getScoreboard(table.tableId);
    // TODO: Add winning amount to winners
    this.logger.log({ amount }, { scoreboard });
    await this.walletProvider.addCbrWinningAmount(
      winnerUserIds,
      amount,
      table.tableId,
      true,
    );
    // TODO: Leave Game History
  }

  async getNextEmptyPlayerId(table: Table) {
    const playerIds = table.players.map(
      (player) => player.playerId,
    ) as string[];
    const playerOrder = ['PL1', 'PL2', 'PL3', 'PL4'];
    return playerOrder.find((item) => !playerIds.includes(item));
  }

  canBeLeadCard(leadCard: Card, card: Card): boolean {
    if (
      this.getCardGroup(leadCard) === this.getCardGroup(card) &&
      this.getCardNumber(leadCard) < this.getCardNumber(card)
    ) {
      return true;
    }
    return false;
  }

  canBeFirstCard(firstCard: Card, card: Card): boolean {
    if (
      this.getCardGroup(firstCard) === this.getCardGroup(card) &&
      this.getCardNumber(firstCard) < this.getCardNumber(card)
    ) {
      return true;
    }
    return false;
  }

  canAddLeadCard(firstCard: Card, card: Card): boolean {
    if (
      this.getCardGroup(firstCard) !== CardGroup.spade &&
      this.getCardGroup(card) === CardGroup.spade
    ) {
      return true;
    }
    return false;
  }

  getCardGroup(card: Card): CardGroup {
    if (card.startsWith('H')) {
      return CardGroup.heart;
    }
    if (card.startsWith('S')) {
      return CardGroup.spade;
    }
    if (card.startsWith('C')) {
      return CardGroup.club;
    }
    return CardGroup.diamond;
  }

  getCardNumber(card: Card): number {
    const array = card.split(',');
    const number_ = Number.parseInt(array[1]);
    return number_;
  }

  compareCards(card1: Card, card2: Card): Card {
    const card1Group = this.getCardGroup(card1);
    const card2Group = this.getCardGroup(card2);
    const card1Number = this.getCardNumber(card1);
    const card2Number = this.getCardNumber(card2);

    if (card1Group === CardGroup.spade || card2Group === CardGroup.spade) {
      if (card1Group === CardGroup.spade && card2Group === CardGroup.spade) {
        return card1Number > card2Number ? card1 : card2;
      } else if (card1Group === CardGroup.spade) {
        return card1;
      } else {
        return card2;
      }
    } else {
      return card1Number > card2Number ? card1 : card2;
    }
  }

  getStrongCard(firstCard: Card, cards: Card[]): Card {
    let strongCard = firstCard;
    for (const card of cards) {
      if (
        this.getCardGroup(firstCard) === this.getCardGroup(card) ||
        this.getCardGroup(card) === CardGroup.spade
      ) {
        strongCard = this.compareCards(strongCard, card);
      }
    }
    return strongCard;
  }

  getWinner(table: Table): PlayerId {
    const cards: Card[] = [];
    table.players.map((player) => {
      cards.push(player?.currentCard as Card);
    });
    const strongCard = this.getStrongCard(table.firstCard as Card, cards);
    const index = table.players.findIndex(
      (player) => player.currentCard === strongCard,
    );
    return table.players[index].playerId;
  }

  getRemainingCards(table: Table, playerId: PlayerId): Card[] {
    const cards: Card[] = [];
    const index = table.players.findIndex(
      (player) => player.playerId === playerId,
    );
    table.players[index].cards?.map((gameCard) => {
      if (!gameCard.thrown) {
        cards.push(gameCard.card);
      }
    });
    return cards;
  }

  getPossibleCards(table: Table, playerId: PlayerId): Card[] {
    const cards: Card[] = [];
    const remainingCards: Card[] = this.getRemainingCards(table, playerId);
    if (table.firstCard) {
      const firstCard = table.firstCard as Card;
      const cardGroup = this.getCardGroup(firstCard);
      if (table.leadCard) {
        remainingCards.map((remainCard) => {
          if (this.getCardGroup(remainCard) === cardGroup) {
            cards.push(remainCard);
          }
        });
        if (cards.length === 0) {
          remainingCards.map((remainCard) => {
            if (
              this.getCardGroup(remainCard) === CardGroup.spade &&
              this.getCardNumber(remainCard) >
                this.getCardNumber(table.leadCard as Card)
            ) {
              cards.push(remainCard);
            }
          });
        }
      } else {
        remainingCards.map((remainCard) => {
          if (
            this.getCardGroup(remainCard) === cardGroup &&
            this.getCardNumber(remainCard) > this.getCardNumber(firstCard)
          ) {
            cards.push(remainCard);
          }
        });
        if (cards.length === 0) {
          remainingCards.map((remainCard) => {
            if (this.getCardGroup(remainCard) === cardGroup) {
              cards.push(remainCard);
            }
          });
        }
        if (cards.length === 0) {
          remainingCards.map((remainCard) => {
            if (this.getCardGroup(remainCard) === CardGroup.spade) {
              cards.push(remainCard);
            }
          });
        }
      }
      if (cards.length === 0) {
        remainingCards.map((remainCard) => {
          cards.push(remainCard);
        });
      }
      return cards;
    } else {
      return remainingCards;
    }
  }

  isPossibleCard(table: Table, card: Card): boolean {
    const cards = this.getPossibleCards(table, table.currentTurn);
    return cards.includes(card) ? true : false;
  }

  getAutoThrowCard(table: Table): Card {
    const cards = this.getPossibleCards(table, table.currentTurn);
    return cards[0];
  }

  getTotalNumber(card: Card): number {
    const cardGroup = this.getCardGroup(card);
    let groupNumber = 0;
    switch (cardGroup) {
      case CardGroup.club: {
        groupNumber = 20;
        break;
      }
      case CardGroup.heart: {
        groupNumber = 40;
        break;
      }
      case CardGroup.diamond: {
        groupNumber = 60;
        break;
      }
      default: {
        groupNumber = 80;
      }
    }
    const cardNumber = this.getCardNumber(card);
    return groupNumber + cardNumber;
  }

  getSortedCards(cards: GameCard[]): GameCard[] {
    for (let index = 0; index < cards.length - 1; index++) {
      for (let index_ = index + 1; index_ < cards.length; index_++) {
        if (
          this.getTotalNumber(cards[index].card) >
          this.getTotalNumber(cards[index_].card)
        ) {
          const temporaryCard: GameCard = cards[index];
          cards[index] = cards[index_];
          cards[index_] = temporaryCard;
        }
      }
    }
    return cards;
  }

  getRoundScore(current: number, handBid: number): string {
    let score: string;
    if (current < handBid) {
      score = (0 - handBid).toFixed(1).toString();
    } else if (current > handBid) {
      score = (handBid + (current - handBid) * 0.1).toFixed(1).toString();
    } else {
      score = handBid.toFixed(1).toString();
    }
    return score;
  }

  async getScoreboard(tableId: string): Promise<ScoreBoardData | undefined> {
    const table = await this.tableService.getTableOrThrowException(tableId);
    try {
      const scoreboard: BoardData[] = table.players.map(
        ({ playerId, userId, playerInfo, active, scores, totalScore }) => ({
          playerId,
          userId,
          username: playerInfo.username,
          active,
          name: playerInfo.name,
          avatar: playerInfo.avatar,
          scores,
          totalScore,
        }),
      );
      const scoreboardData = {
        scoreboard,
        tableId: table.tableId,
        isFinalRound: table.roundNo === table.totalRounds ? true : false,
      };
      return scoreboardData;
    } catch (error) {
      this.logger.log(error);
    }
  }

  async sendNotification(tableId: string) {
    const stuckTableIds = await this.transientDBService.getStuckTable();
    if (stuckTableIds.includes(tableId)) {
      return;
    }

    await this.transientDBService.storeStuckTable(tableId);
    // this.sqs.sendRequest<any>({
    //   channel: Channel.verifications,
    //   op: 'sendEmailNotification',
    //   body: {
    //     tableId,
    //   },
    //   corId: nanoid(9),
    //   user: {
    //     _id: '123456789012345678901234',
    //     roles: [Role.admin],
    //   },
    // });
  }

  async sendQueueNotification(queueName: string) {
    this.logger.log({ queueName });
  }
}
