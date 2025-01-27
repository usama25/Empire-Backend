/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint unicorn/no-await-expression-member: 0 */
/* eslint-disable unicorn/consistent-destructuring */
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import {
  Table,
  TableType,
  CardsDeck,
  Card,
  GameStatus,
  PlayerId,
  PlayerGameInfo,
  TableWithPid,
  GameOutcome,
  GameTypes,
  Currency,
  TableID,
  UserID,
} from '@lib/fabzen-common/types';

import { CommonService } from './common.service';
import { RedisTransientDBService } from '../transient-db/redis-backend';
import { ReQueueService, WaitingTableQueueService } from '../queue';
import {
  getCardInfo,
  getNoPlayers,
  getReNoPlayers,
  leaveLogs,
} from '../../utils/re-gameplay.utils';
import { ReGameplayGateway } from '../../re-gameplay.gateway';
import Big from 'big.js';
import { customAlphabet, nanoid } from 'nanoid';
import { Role } from '@lib/fabzen-common/types';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { config } from '@lib/fabzen-common/configuration';
import { RedisService } from '../transient-db/redis/service';
import { isEmpty, shuffle } from 'lodash';
import {
  ReCard,
  ReCardsDeck,
  ReCardsGroup,
  ReDealCardsResponse,
  ReGameStatus,
  ReGameType,
  RePlayerId,
  RePlayerInfo,
  ReTable,
  ReTableType,
  ReTableWithPid,
} from '../../re-gameplay.types';
import * as dayjs from 'dayjs';
const { activeTableKey, processStatus } = config.reGameplay.redis.keyPrefixes;

@Injectable()
export class TableService {
  constructor(
    @Inject(forwardRef(() => CommonService))
    private commonService: CommonService,
    @Inject(forwardRef(() => ReQueueService))
    private reQueueService: ReQueueService,
    @Inject(forwardRef(() => RedisService))
    private redisService: RedisService,
    private readonly reGameplayGateway: ReGameplayGateway,
    private readonly transientDBService: RedisTransientDBService,
    private readonly waitingTableQueueService: WaitingTableQueueService,
  ) {}

  /**
   * Store both Table in Redis
   */
  async storeTable(table: Table): Promise<void> {
    await this.transientDBService.setActiveTable(table);
  }

  async storeReTable(table: ReTable): Promise<void> {
    await this.transientDBService.setActiveReTable(table);
  }

  /**
   * Get both Table Info and State From Redis
   */
  async getTable(tableId: string): Promise<Table | undefined> {
    return this.transientDBService.getActiveTable(tableId);
  }

  async getReTable(tableId: string): Promise<ReTable | undefined> {
    return this.transientDBService.getActiveReTable(tableId);
  }

  async getTableOrThrowException(tableId: string): Promise<TableWithPid> {
    const pid = customAlphabet(config.spGameplay.alphaNumberics, 12)();
    await this.redisService.aquireLock(tableId, pid);

    const table = await this.getTable(tableId);
    if (!table) {
      await this.redisService.releaseLock(tableId, pid);
      throw new BadRequestException(`Table ${tableId} does not exist`);
    }
    return { table, pid };
  }

  async getReTableOrThrowException(tableId: string): Promise<ReTableWithPid> {
    const pid = customAlphabet(config.reGameplay.alphaNumberics, 12)();
    await this.redisService.aquireLock(tableId, pid);

    const table = await this.getReTable(tableId);
    if (!table) {
      await this.redisService.releaseLock(tableId, pid);
      throw new BadRequestException(`Table ${tableId} does not exist`);
    }
    return { table, pid };
  }

  // get connected users for reconnection
  async connected(userId: UserID, socketId: string) {
    try {
      const [activeTableId, previousSocketId, waitingInfo] = await Promise.all([
        this.transientDBService.getUserActiveTableId(userId),
        this.transientDBService.getUserSocketId(userId),
        this.transientDBService.getReUserWaitingTable(userId),
      ]);
      this.transientDBService.setUserSocketId(userId, socketId);

      if (activeTableId) {
        try {
          const { table, pid } =
            await this.getReTableOrThrowException(activeTableId);
          leaveLogs('reconnection lock', { tableId: table.tableId, pid });
          await this.redisService.releaseLock(table.tableId, pid);
          leaveLogs('reconnection unlock', { tableId: table.tableId, pid });

          return {
            isReconnected: true,
            tableId: activeTableId,
            table,
            prevClientId: previousSocketId,
          };
        } catch (error) {
          console.log(
            `ReconnectionBugTrace error during reconnection ${JSON.stringify(
              error,
            )}`,
          );
          return {
            isReconnected: false,
            tableId: activeTableId,
            prevClientId: previousSocketId,
          };
        }
      } else {
        return waitingInfo
          ? {
              isReconnected: true,
              status: ReGameStatus.waiting,
              waitingInfo,
              prevClientId: previousSocketId,
            }
          : {
              isReconnected: false,
              status: ReGameStatus.waiting,
              prevClientId: previousSocketId,
            };
      }
    } catch (error) {
      console.log(error);
      return {};
    }
  }

  handleTableResponse(table: Table, userId: UserID) {
    if (table.playersAmount) {
      delete table.playersAmount;
    }
    const { joinNo, turnNo, skipTurnNo, ...tableResponse } = table;
    const tableData: any = { ...tableResponse };
    tableData.players = tableResponse.players.map((player) => {
      const { betAmount, startAmount, roundAmount, ...playerResponse } = player;
      const playerData: any = { ...playerResponse };
      playerData.walletBalance = this.commonService.getSubWalletBalance(
        playerData.walletBalance,
      );
      playerData.packed = !playerResponse.active && !!playerResponse.firstCard;
      return playerData;
    });
    tableData.players = tableData.players.map((player: any) => {
      player.amount = this.commonService.getSubWalletSum(player.amount);
      return player;
    });
    tableData.limitAmount = Big(table.tableType.potLimit)
      .minus(table.potAmount)
      .toString();

    if (table.hidden) {
      delete tableData.commonCard;
    }
    if (
      table.gameStatus === GameStatus.gameEnded ||
      table.gameStatus === GameStatus.roundEnded ||
      table.gameStatus === GameStatus.showdown
    ) {
      delete tableData.currentTurn;
    }
    const myPlayerId = table.players.find(
      (player) => player.userId === userId,
    )?.playerId;

    if (
      table.gameStatus !== GameStatus.gameEnded &&
      table.gameStatus !== GameStatus.roundEnded &&
      table.gameStatus !== GameStatus.showdown
    ) {
      tableData.players.map((player: any) => {
        if (player.userId === userId) {
          if (!player.seen) {
            delete player.hiddenCards;
          } else if (table.commonCard && player.firstCard && !table.hidden) {
            player.playerCardsInfo = this.commonService.getPlayerCardsInfo([
              player.firstCard,
              ...player.hiddenCards,
              table.commonCard,
            ]);
          }
        } else {
          delete player.firstCard;
          delete player.hiddenCards;
        }
      });
    } else {
      const response = table.roundEndInfo;
      delete tableData.roundEndInfo;
      return {
        ...response,
        ...tableData,
        myPlayerId,
      };
    }
    if (table.gameStatus === GameStatus.sideshow) {
      const previousPlayerIndex = this.getPrevPlayerIndex(table);
      const receivePlayer = table.players[
        previousPlayerIndex
      ] as PlayerGameInfo;
      const startPlayer = table.players.find(
        (player) => player.playerId === table.currentTurn,
      ) as PlayerGameInfo;
      if (table.sideshowAccepted === undefined) {
        return {
          ...tableData,
          myPlayerId,
          startPlayerId: startPlayer.playerId,
          receivePlayerId: receivePlayer.playerId,
        };
      } else if (table.sideshowAccepted) {
        const sideshowResult = this.commonService.sideShow(
          table,
          startPlayer.playerId,
          receivePlayer.playerId,
        );
        // return different results according to the user
        if (startPlayer.userId === userId) {
          return {
            ...sideshowResult,
            cards: [
              receivePlayer?.firstCard,
              ...(receivePlayer?.hiddenCards as [Card, Card]),
            ],
            myPlayerId,
            startPlayerId: startPlayer.playerId,
            receivePlayerId: receivePlayer.playerId,
            ...tableData,
          };
        } else if (receivePlayer.userId === userId) {
          return {
            ...sideshowResult,
            cards: [
              startPlayer?.firstCard,
              ...(startPlayer?.hiddenCards as [Card, Card]),
            ],
            startPlayerId: startPlayer.playerId,
            receivePlayerId: receivePlayer.playerId,
            myPlayerId,
            ...tableData,
          };
        } else {
          return {
            winner: sideshowResult.winner,
            startPlayerId: startPlayer.playerId,
            receivePlayerId: receivePlayer.playerId,
            myPlayerId,
            ...tableData,
          };
        }
      } else if (table.sideshowAccepted === false) {
        return {
          accepted: table.sideshowAccepted,
          startPlayerId: startPlayer.playerId,
          receivePlayerId: receivePlayer.playerId,
          myPlayerId,
          ...tableData,
        };
      }
    }

    return { ...tableData, myPlayerId };
  }

  handleReTableResponse(table: ReTable, userId: UserID) {
    if (
      table.gameStatus === ReGameStatus.gameEnded ||
      table.gameStatus === ReGameStatus.roundEnded
    ) {
      table.currentTurn = RePlayerId.pl1;
    }
    const myPlayerId = table.players.find(
      (player) => player.userId === userId,
    )?.playerId;

    return { ...table, myPlayerId };
  }

  /**
   * Check if the user has already in process of Rummy game
   */
  async checkReDoubleJoin(tableType: ReTableType, userId: string) {
    const [activeTableId, isOnWaitingQueue] = await Promise.all([
      this.transientDBService.getUserActiveTableId(userId),
      this.waitingTableQueueService.isUserOnReQueue(tableType, userId),
    ]);

    return !!activeTableId || isOnWaitingQueue;
  }

  /**
   * Delete both Table Info and State in Redis
   */
  async removeTable(table: Table) {
    const { tableId, players } = table;

    return Promise.all([
      // remove table from redis
      this.transientDBService.deleteActiveTable(tableId),
      // remove all user table key
      ...players.map(({ userId }) =>
        this.transientDBService.deleteUserActiveTableId(userId),
      ),
      ...players.map(({ userId }) => this.commonService.unlockUser(userId)),
    ]);
  }

  async removeReTable(table: ReTable) {
    const { tableId, players } = table;

    return Promise.all([
      // remove table from redis
      this.transientDBService.deleteActiveReTable(tableId),
      // remove all user table key
      ...players.map(({ userId }) =>
        this.transientDBService.deleteReUserActiveTableId(userId),
      ),
      ...players.map(({ userId }) => this.commonService.unlockUser(userId)),
    ]);
  }

  /**
   * Update both Table in Redis
   */
  async updateTable(table: Table, pid: string): Promise<void> {
    try {
      const tableId = table.tableId;
      const oldTable = await this.transientDBService.getActiveTable(tableId);
      if (!oldTable) {
        throw new InternalServerErrorException(`Table ${tableId}`);
      }
      table.players.sort((player1: PlayerGameInfo, player2: PlayerGameInfo) => {
        if (player1.playerId < player2.playerId) {
          return -1;
        }
        if (player1.playerId > player2.playerId) {
          return 1;
        }
        return 0;
      });
      await this.transientDBService.setActiveTable(table);
      await this.redisService.releaseLock(tableId, pid);
    } catch (error) {
      console.log(error);
    }
  }

  async updateReTable(table: ReTable, pid: string): Promise<void> {
    try {
      const tableId = table.tableId;
      const oldTable = await this.transientDBService.getActiveReTable(tableId);
      if (!oldTable) {
        throw new InternalServerErrorException(`Table ${tableId}`);
      }
      table.players.sort((player1: RePlayerInfo, player2: RePlayerInfo) => {
        if (player1.playerId < player2.playerId) {
          return -1;
        }
        if (player1.playerId > player2.playerId) {
          return 1;
        }
        return 0;
      });
      await this.transientDBService.setActiveReTable(table);
      await this.redisService.releaseLock(tableId, pid);
    } catch (error) {
      console.log(error);
    }
  }

  async leaveReTable(
    table: Table,
    userId: string,
    pid: string,
    isManual?: boolean,
    isSideshow?: boolean,
  ) {
    const players = table.players;
    const playerIndex = players.findIndex((player) => player.userId === userId);

    const playerId = players[playerIndex].playerId;
    this.commonService.createLeftUserTableHistory(table, userId);

    // Round History
    if (isManual && players[playerIndex].betAmount !== '0') {
      this.commonService.createLeftUserRoundHistory(table, userId);
    }

    players.splice(playerIndex, 1);
    table.players = players;

    // decide if there is winner
  }

  getActivePlayers(table: Table) {
    return table.players.filter((player) => player.active);
  }

  getReActivePlayers(table: ReTable) {
    return table.players.filter((player) => player.active);
  }

  getReRemainingPlayers(table: ReTable) {
    return table.players.filter((player) => !player.drop);
  }

  getAllinPlayers(table: Table) {
    return table.players.filter((player) => !player.active && player.allin);
  }

  getNextActivePlayer(table: Table) {
    const players = this.getActivePlayers(table);
    return isEmpty(players)
      ? table.players.find((player) => player.playerId > table.currentTurn) ||
          table.players[0]
      : players.find((player) => player.playerId > table.currentTurn) ||
          players[0];
  }

  getReNextActivePlayer(table: ReTable) {
    const players = this.getReActivePlayers(table);
    return isEmpty(players)
      ? table.players.find((player) => player.playerId > table.currentTurn) ||
          table.players[0]
      : players.find((player) => player.playerId > table.currentTurn) ||
          players[0];
  }

  getDealer(table: ReTable) {
    const randomIndex = Math.floor(Math.random() * table.players.length);
    return table.players[randomIndex].playerId;
  }

  getPlayerFromUserId(table: Table, userId: UserID) {
    const player = table.players.find((player) => player.userId === userId);
    return player;
  }

  getNextDealer(table: Table) {
    const dealerIndex = table.players.findIndex(
      (player) =>
        !player.rebuying && player.playerId > (table.dealerId as PlayerId),
    );
    return dealerIndex === -1
      ? (table.players.find((player) => !player.rebuying) as PlayerGameInfo)
          .playerId
      : table.players[dealerIndex].playerId;
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

  async getEmptySeatReTables(tableType: ReTableType): Promise<ReTable[]> {
    // skip two player table
    if (tableType.maxPlayer === ReGameType.twoplayer) {
      return [];
    }

    const tableIds = await this.redisService.getKeys(activeTableKey);
    // sort tableId to avoid focused join
    tableIds.sort(() => Math.random() - 0.5);

    if (!tableIds) {
      return [];
    }
    const emptySeatTables: ReTable[] = [];

    for (const tableId of tableIds) {
      const _table = await this.transientDBService.getActiveReTable(tableId);
      if (
        !_table ||
        _table.tableType.tableTypeId !== tableType.tableTypeId ||
        _table.locked ||
        _table.gameStatus === ReGameStatus.gameEnded
      ) {
        continue;
      }

      if (dayjs().isAfter(dayjs(_table.timeout))) {
        await Promise.all(
          _table.players.map((player) => {
            this.transientDBService.deleteReUserWaitingTable(player.userId);
          }),
        );

        this.transientDBService.deleteActiveReTable(tableId);
        continue;
      }

      const { table, pid } = await this.getReTableOrThrowException(tableId);
      leaveLogs('RE empty table lock', { tableId, pid });
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('RE empty table unlock', { tableId, pid });

      if (
        table.players.length < getReNoPlayers(table.tableType) &&
        table.gameStatus !== ReGameStatus.gameEnded
      ) {
        console.log('Checking Updated players', tableId, table.players);
        emptySeatTables.push(table);
      }

      console.log('Empty Seat Tables', tableId, emptySeatTables);
    }
    return emptySeatTables;
  }

  // get previous player's lastBetAmount
  getPrevBetAmount(table: Table) {
    const currentPlayerIndex = table.players.findIndex(
      (player) => player.playerId === table.currentTurn,
    );
    const player = table.players[currentPlayerIndex];
    const previousPlayerIndex = this.getPrevPlayerIndex(table);
    const previousPlayer = table.players[previousPlayerIndex];
    return player.seen && table.hidden
      ? Big(previousPlayer.lastBetAmount as string)
          .mul(2)
          .toString()
      : (previousPlayer.lastBetAmount as string);
  }

  getCurrentPlayerIndex(table: Table) {
    return table.players.findIndex(
      (player) => player.playerId === table.currentTurn,
    );
  }

  async dealReCards(table: ReTable): Promise<ReTable> {
    // let { commonCard } = table;
    const { players } = table;

    const numberCardsPerPlayer = 13;
    const openDeckCards: string[] = [];
    // const playerCards: any[] = [];
    let cardsArray: string[] = [];
    const shuffledCards = await this.shuffleReCards(ReCardsDeck);
    console.log('Shuffled Cards', shuffledCards);
    for (const player of players) {
      for (let index = 0; index < numberCardsPerPlayer; index++) {
        const card = shuffledCards.shift();
        cardsArray.push(card as ReCard);
      }
      console.log('Player Cards Array', cardsArray);
      // playerCards.push(cardsArray);
      player.cards = cardsArray;
      player.cardsGroups = this.commonService.getSortedCards(cardsArray);
      cardsArray = [];
    }

    const openCard = shuffledCards.shift();
    if (openCard) {
      openDeckCards.push(openCard);
    }
    table.openDeckCards = openDeckCards;

    let randomIndex: number = Math.floor(Math.random() * shuffledCards.length);
    while (
      getCardInfo(shuffledCards[randomIndex]) === ReCard.cdRedJoker ||
      getCardInfo(shuffledCards[randomIndex]) === ReCard.cdBlackJoker
    ) {
      randomIndex = Math.floor(Math.random() * shuffledCards.length);
    }
    table.wildCard = shuffledCards[randomIndex];

    table.players = players;
    table.gameStatus = ReGameStatus.dealCards;
    table.closedDeckCards = shuffledCards;

    console.log('Deal Cards Result', table);

    return table;
  }

  // TODO: Update Shuffling Logic for RE
  async shuffleReCards(cards: typeof ReCardsDeck) {
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
    // TODO: Check Rummy Game Rules HERE
    return true;
  }
}
