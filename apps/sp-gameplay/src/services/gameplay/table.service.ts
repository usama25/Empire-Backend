/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint unicorn/no-await-expression-member: 0 */
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
import { SpQueueService, WaitingTableQueueService } from '../queue';
import { getNoPlayers, leaveLogs } from '../../utils/sp-gameplay.utils';
import { SpGameplayGateway } from '../../sp-gameplay.gateway';
import Big from 'big.js';
import { customAlphabet, nanoid } from 'nanoid';
import { Role } from '@lib/fabzen-common/types';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { config } from '@lib/fabzen-common/configuration';
import { RedisService } from '../transient-db/redis/service';
import { isEmpty } from 'lodash';
const { activeTableKey, processStatus } = config.spGameplay.redis.keyPrefixes;

@Injectable()
export class TableService {
  constructor(
    @Inject(forwardRef(() => CommonService))
    private commonService: CommonService,
    @Inject(forwardRef(() => SpQueueService))
    private spQueueService: SpQueueService,
    @Inject(forwardRef(() => RedisService))
    private redisService: RedisService,
    private readonly spGameplayGateway: SpGameplayGateway,
    private readonly transientDBService: RedisTransientDBService,
    private readonly waitingTableQueueService: WaitingTableQueueService,
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

  // get connected users for reconnection
  async connected(userId: UserID, socketId: string) {
    try {
      const [activeTableId, previousSocketId, waitingInfo] = await Promise.all([
        this.transientDBService.getUserActiveTableId(userId),
        this.transientDBService.getUserSocketId(userId),
        this.transientDBService.getUserWaitingTable(userId),
      ]);
      this.transientDBService.setUserSocketId(userId, socketId);

      if (activeTableId) {
        try {
          const { table, pid } =
            await this.getTableOrThrowException(activeTableId);
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
              status: GameStatus.waiting,
              waitingInfo,
              prevClientId: previousSocketId,
            }
          : {
              isReconnected: false,
              status: GameStatus.waiting,
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

  /**
   * Check if the user has already in process of game
   */
  async checkDoubleJoin(tableType: TableType, userId: string) {
    const [activeTableId, isOnWaitingQueue] = await Promise.all([
      this.transientDBService.getUserActiveTableId(userId),
      this.waitingTableQueueService.isUserOnQueue(tableType, userId),
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

  async leaveTable(
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

    // when the current turn player leaves in deal cards,
    // sideshow player leaves, sideshow next player leaves after accepted/rejected
    if (
      (table.currentTurn === playerId &&
        table.gameStatus === GameStatus.dealCards) ||
      isSideshow ||
      (table.sideshowAccepted !== undefined &&
        table.currentTurn === playerId &&
        table.gameStatus === GameStatus.playing)
    ) {
      const nextPlayer = this.getNextActivePlayer(table);
      const nextTurn = nextPlayer.playerId;
      table.currentTurn = nextTurn;
    }

    // decide if there is winner
    const roundEnded = table.gameStatus === GameStatus.roundEnded;
    const activePlayers = this.getActivePlayers(table);
    const allinPlayers = this.getAllinPlayers(table);
    const lastBetAmount =
      activePlayers.length > 0 ? activePlayers[0].lastBetAmount : '0';
    const tableChaalAmount = table.chaalAmount;
    if (
      (activePlayers.length === 0 ||
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(tableChaalAmount))) ||
        allinPlayers.length + activePlayers.length <= 1) &&
      table.gameStatus !== GameStatus.gameEnded &&
      table.gameStatus !== GameStatus.roundEnded
    ) {
      table.gameStatus = GameStatus.roundEnded;
    }
    if (table.players.length < 2 && table.gameStatus !== GameStatus.gameEnded) {
      table.gameStatus = GameStatus.gameEnded;
    }
    await this.updateTable(table, pid);
    leaveLogs('leaveTable unlock', { tableId: table.tableId, pid });
    leaveLogs('player left table', { table, userId });

    await this.transientDBService.deleteUserActiveTableId(userId);

    if (table.players.length < 2) {
      await this.spGameplayGateway.endGame(table.tableId);
      return;
    }

    // decide if there is winner
    if (
      (activePlayers.length === 0 ||
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(tableChaalAmount))) ||
        allinPlayers.length + activePlayers.length <= 1) &&
      table.gameStatus !== GameStatus.gameEnded &&
      !roundEnded
    ) {
      await this.spGameplayGateway.roundEnd(table.tableId);
      return;
    }

    if (
      table.currentTurn === playerId &&
      table.gameStatus === GameStatus.playing
    ) {
      if (table.sideshowAccepted !== undefined && !isSideshow) {
        return;
      }
      await this.spGameplayGateway.next(table.tableId, isSideshow);
    }
  }

  getActivePlayers(table: Table) {
    return table.players.filter((player) => player.active);
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

  async getEmptySeatTables(tableType: TableType): Promise<Table[]> {
    // skip two player table
    if (tableType.gameType === GameTypes.twoPlayer) {
      return [];
    }

    const tableIds = await this.redisService.getKeys(activeTableKey);
    // sort tableId to avoid focused join
    tableIds.sort(() => Math.random() - 0.5);

    if (!tableIds) {
      return [];
    }
    const emptySeatTables: Table[] = [];

    for (const tableId of tableIds) {
      const _table = await this.transientDBService.getActiveTable(tableId);
      if (
        !_table ||
        _table.tableType.tableTypeId !== tableType.tableTypeId ||
        _table.locked ||
        _table.gameStatus === GameStatus.gameEnded
      ) {
        continue;
      }

      leaveLogs('empty table create', { tableId });
      const { table, pid } = await this.getTableOrThrowException(tableId);
      leaveLogs('empty table lock', { tableId, pid });
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('empty table unlock', { tableId, pid });

      if (
        table.players.length < getNoPlayers(table.tableType) &&
        table.gameStatus !== GameStatus.gameEnded
      ) {
        emptySeatTables.push(table);
      }
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

  async dealCards(table: Table) {
    let { commonCard } = table;
    const { players, dealerId } = table;
    const shuffledCards = await this.shuffleCards(CardsDeck);

    const dealerIndex = players.findIndex(
      (player) => player.playerId === dealerId,
    );

    let currentPlayerIndex = (dealerIndex + 1) % players.length;
    const numberCardsPerPlayer = 3;
    for (let index_ = 0; index_ < numberCardsPerPlayer; index_++) {
      for (let index = 0; index < players.length; index++) {
        const currentPlayer = players[currentPlayerIndex];
        if (currentPlayer.active) {
          const card = shuffledCards.shift();
          if (index_ === 0) {
            currentPlayer.firstCard = card as Card;
          } else {
            if (!currentPlayer.hiddenCards) {
              currentPlayer.hiddenCards = ['2C', '2C'] as [Card, Card];
            }
            currentPlayer.hiddenCards[index_ - 1] = card as Card;
          }
        }
        currentPlayer.seen = false; // Set seen property to false
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      }
    }

    const [commonCard1, commonCard2] = shuffledCards.splice(0, 2);
    commonCard = commonCard1 as Card;
    if (!commonCard) {
      commonCard = '2C' as Card;
    }
    table.commonCard = commonCard;
    table.hidden = true;
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
}
