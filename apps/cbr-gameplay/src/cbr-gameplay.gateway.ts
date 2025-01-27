import { Server, Socket } from 'socket.io';
import * as dayjs from 'dayjs';
import Big from 'big.js';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { delay } from '@lib/fabzen-common/utils/time.utils';

import { ExtendedSocket, TransporterProviders } from '@lib/fabzen-common/types';
import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';
import {
  WsData,
  WsSubscribeMessage,
  WsUserID,
} from '@lib/fabzen-common/decorators/ws.decorator';
import {
  Card,
  GameAction,
  GameStatus,
  PlayerGameEndInfo,
  PlayerId,
  PlayerInfo,
  Table,
  TableType,
} from './cbr-gameplay.types';
import {
  EmojiData,
  HandBidRequest,
  JoinTableRequest,
  MessageData,
  ThrowCardRequest,
} from './cbr-gameplay.dto';

import { CbrMaintenanceGuard } from './guards/index';

import { CommonService, TableService } from './services/gameplay';
import { CbrQueueService } from './services/queue/cbr-queue.service';
import { config } from '@lib/fabzen-common/configuration';
import { RedisTransientDBService } from './redis/backend';
import { RedisService } from './redis/service';
import { CbrGameplayService } from './cbr-gameplay.service';
import { WsJwtGuard } from '@lib/fabzen-common/guards/ws-jwt.guard';
import { verifyJwtTokenInSocketIo } from '@lib/fabzen-common/utils/jwt.util';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { isEqual } from 'lodash';
import { UserProvider } from 'apps/user/src/user.provider';
import { ClientProxy } from '@nestjs/microservices';
import { AuthenticatedSocket } from '@lib/fabzen-common/types/socket.types';
import { NotificationProvider } from 'apps/notification/src/notification.provider';
import { SocketGatewayProvider } from 'apps/socket-gateway/src/socket-gateway.provider';
import { UserRepository } from 'apps/user/src/domain/interfaces';

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class CbrGameplayGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() wss!: Server;
  private readonly logger = new FbzLogger(CbrGameplayGateway.name);
  private readonly userProvider: UserProvider;
  private readonly notificationProvider: NotificationProvider;
  private readonly socketGatewayProvider: SocketGatewayProvider;

  constructor(
    @Inject(forwardRef(() => RedisTransientDBService))
    private readonly transientDBService: RedisTransientDBService,
    @Inject(forwardRef(() => CommonService))
    private readonly commonService: CommonService,
    @Inject(forwardRef(() => RedisService))
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => TableService))
    private readonly tableService: TableService,
    @Inject(forwardRef(() => CbrQueueService))
    private readonly cbrQueueService: CbrQueueService,
    @Inject(forwardRef(() => CbrGameplayService))
    private readonly cbrGameplayService: CbrGameplayService,
    @Inject(forwardRef(() => RemoteConfigService))
    private readonly configService: RemoteConfigService,
    @Inject(TransporterProviders.USER_SERVICE)
    private userClient: ClientProxy,
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
    @Inject(TransporterProviders.SOCKET_GATEWAY_SERVICE)
    private socketGatewayClient: ClientProxy,
    private readonly userRepository: UserRepository,
  ) {
    this.userProvider = new UserProvider(this.userClient);
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );
    this.socketGatewayProvider = new SocketGatewayProvider(
      this.socketGatewayClient,
    );
  }

  async handleConnection(client: Socket) {
    verifyJwtTokenInSocketIo(client);
    const { user, id: socketId } = client as AuthenticatedSocket;
    const userId = user.userId;
    client.join(userId);
    this.wss.to(userId).except(socketId).emit('forceLogout', {
      cause: 'Logged in from other device',
    });
    this.wss.in(userId).except(socketId).disconnectSockets(true);
    try {
      client.emit('serverTime', { time: dayjs().toISOString() });

      // check this user has already joined table or not
      const { isReconnected, tableId, table } =
        await this.tableService.connected(userId);

      if (isReconnected) {
        if (table) {
          client.join(tableId);
          const reconnectTableResponse = this.tableService.handleTableResponse(
            table,
            userId,
          );
          const returnTable = reconnectTableResponse.table;

          if (returnTable.gameStatus === GameStatus.waiting) {
            const {
              tableId,
              tableType,
              roundNo,
              handNo,
              totalRounds,
              gameStatus,
              players,
              timeout,
            } = returnTable;
            client.emit('reconnectGame', {
              table: {
                tableId,
                tableType,
                roundNo,
                handNo,
                totalRounds,
                gameStatus,
                players,
                timeout,
                myPlayerId: reconnectTableResponse.myPlayerId,
              },
              isReconnected: true,
            });
          } else {
            returnTable.myPlayerId = reconnectTableResponse.myPlayerId;
            const currentDealerId = this.tableService.getCurrentRoundDealer(
              reconnectTableResponse.table,
            );
            const dealerId =
              reconnectTableResponse.table.roundNo === 1
                ? PlayerId.pl4
                : currentDealerId;
            returnTable.dealerId = dealerId;

            if (returnTable.gameStatus === GameStatus.roundStarted) {
              const {
                tableId,
                myPlayerId,
                tableType,
                roundNo,
                handNo,
                totalRounds,
                gameStatus,
                players,
                timeout,
                dealerId,
                currentTurn,
              } = returnTable;
              client.emit('reconnectGame', {
                table: {
                  tableId,
                  myPlayerId,
                  tableType,
                  dealerId,
                  currentTurn,
                  roundNo,
                  handNo,
                  totalRounds,
                  gameStatus,
                  players,
                  timeout,
                },
                playableCards: reconnectTableResponse.playableCards,
                cards: reconnectTableResponse.cards,
                isReconnected: true,
              });
            } else if (table.gameStatus === GameStatus.gameEnded) {
              const { winners, amount } =
                this.tableService.getGameWinners(table);
              client.emit('reconnectGame', {
                tableId: table.tableId,
                gameStats: table.gameStatus,
                roundNo: table.roundNo,
                winners,
                amount,
              });
            } else {
              client.emit('reconnectGame', {
                table: returnTable,
                playableCards: reconnectTableResponse.playableCards,
                cards: reconnectTableResponse.cards,
                isReconnected: true,
              });
            }
          }
        } else {
          client.emit('reconnectGame', {
            isReconnected,
            tableId,
          });
        }
      } else {
        client.emit('reconnectGame', { isReconnected });
      }
    } catch (error) {
      throw error;
    } finally {
    }
  }

  /**
   * Socket Disconnection Handler
   *
   * 1. Broadcast current online user count
   * 2. Clean up Redis
   */
  async handleDisconnect() {}

  /**
   * Connection Check with ping-pong
   */
  @WsSubscribeMessage('ping')
  async onPing(client: ExtendedSocket) {
    this.logger.log({ client });
    this.commonService.sendNotification('123455');
  }

  /**
   * FIX: ONLY FOR DEV: Redis flush request
   */
  @WsSubscribeMessage('flush')
  onFlush(client: ExtendedSocket) {
    this.redisService.flushAll();
    client.emit('flush', { message: 'Redis flushed successfully' });
  }

  /**
   * Join Table
   */
  @UseGuards(CbrMaintenanceGuard)
  @WsSubscribeMessage('joinTable')
  async onJoinTableEvent(
    @WsUserID() userId: string,
    @WsData(JoinTableRequest) { tableTypeId }: JoinTableRequest,
  ) {
    const tables = this.configService.getCbrTables();
    const tableType = tables.find((table) => table.tableTypeId === tableTypeId);
    if (!tableType) {
      throw new BadRequestException(`No Table Type with id ${tableTypeId}`);
    }
    const tableTypeConfig = tables.find(
      (table: any) => table.tableTypeId === tableType.tableTypeId,
    );

    if (!isEqual(tableType, tableTypeConfig)) {
      throw new BadRequestException('tableType is inconsistent with config');
    }
    try {
      await Promise.all([
        this.redisService.aquireLock(userId),
        this.redisService.aquireLock(tableType.tableTypeId),
      ]);

      const doubleJoined = await this.tableService.checkDoubleJoin(userId);
      if (doubleJoined) {
        throw new BadRequestException(`Only one table can be joined at a time`);
      }
      if (tableType.amount === '0') {
        const availableFreeGameCount =
          await this.userRepository.availableFreeGameCount(userId);
        if (availableFreeGameCount <= 0) {
          throw new BadRequestException(`No Free Game Available`);
        }
      } else {
        const isBalanceEnough = await this.commonService.checkWalletBalance(
          userId,
          tableType.amount,
        );
        if (!isBalanceEnough) {
          throw new BadRequestException(`Wallet balance is not enough`);
        }
      }
      await this.cbrGameplayService.joinTable(tableType, userId);
    } catch (error) {
      this.logger.log('ERROR in JoinTable Event.', userId);
      throw error;
    } finally {
      await Promise.all([
        this.redisService.releaseLock(userId),
        this.redisService.releaseLock(tableType.tableTypeId),
      ]);
    }
  }

  @WsSubscribeMessage('handBid')
  async onHandBidEvent(
    @WsUserID() userId: string,
    @WsData(HandBidRequest) { hand }: HandBidRequest,
  ) {
    if (hand < 1 || hand > 13) {
      throw new BadRequestException(
        'Hand is invalid number. Should be 1 to 13.',
      );
    }
    await this.redisService.aquireLock(userId);
    let tableId;
    try {
      tableId = await this.transientDBService.getUserActiveTableId(userId);
      if (tableId) {
        await this.redisService.aquireLock(tableId);
        const table = await this.tableService.getTableOrThrowException(tableId);
        if (table.gameStatus !== GameStatus.handBid || table.turnNo >= 4) {
          throw new BadRequestException(
            'Hand Bid is ended Or not Hand Bid Status.',
          );
        }

        const playerIndex = table.players.findIndex(
          (player) => player.userId === userId,
        );
        if (table.currentTurn !== table.players[playerIndex].playerId) {
          throw new BadRequestException('Not your turn.');
        }
        // Update table
        table.players[playerIndex].handBid = hand;
        await Promise.all(
          table.players.map(async (player) => {
            if (player.active) {
              this.wss.in(player.userId).emit('handBidRes', {
                tableId: table.tableId,
                myPlayerId: player.playerId,
                gameStatus: table.gameStatus,
                playerId: table.players[playerIndex].playerId,
                hand,
                serverTime: dayjs().toISOString(),
              });
            }
          }),
        );
        table.turnNo = table.turnNo + 1;
        const nextPlayer = this.tableService.getNextPlayer(table) as PlayerInfo;
        table.currentTurn = nextPlayer?.playerId;
        table.updatedAt = dayjs().toISOString();
        await this.tableService.storeTable(table);
        if (table.turnNo === 4) {
          // table.gameStatus = GameStatus.playing;
          await this.tableService.storeTable(table);
          await delay(2000);
          await this.throwCard(table.tableId);
        } else {
          await this.handBid(tableId);
        }
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      this.logger.log(
        `ERROR in HandBid Event. Table ID: ${tableId}, User ID: ${userId}`,
      );
      throw error;
    } finally {
      await this.redisService.releaseLock(userId);
      if (tableId) {
        await this.redisService.releaseLock(tableId);
      }
    }
  }

  @WsSubscribeMessage('throwCard')
  async onThrowCardEvent(
    @WsUserID() userId: string,
    @WsData(ThrowCardRequest) { card }: ThrowCardRequest,
  ) {
    await this.redisService.aquireLock(userId);
    let tableId;
    try {
      tableId = await this.transientDBService.getUserActiveTableId(userId);
      if (tableId) {
        await this.redisService.aquireLock(tableId);
        const table = await this.tableService.getTableOrThrowException(tableId);
        if (table.gameStatus !== GameStatus.playing || table.turnNo < 4) {
          throw new BadRequestException('Not throw card status');
        }
        if (!this.commonService.isPossibleCard(table, card)) {
          throw new BadRequestException('Not possible throwing card');
        }
        const playerIndex = table.players.findIndex(
          (player) => player.userId === userId,
        );
        if (table.currentTurn !== table.players[playerIndex].playerId) {
          throw new BadRequestException('Not your turn.');
        }
        if (table.players[playerIndex].currentCard) {
          throw new BadRequestException('You already throw a card.');
        }
        let flag = false;
        table.players[playerIndex].cards?.map((gameCard) => {
          if (gameCard.card === card) {
            gameCard.thrown = true;
            flag = true;
          }
        });
        if (!flag) {
          throw new BadRequestException('You do not have this card.');
        }
        // update the table
        table.players[playerIndex].currentCard = card;
        await Promise.all(
          table.players.map(async (player) => {
            if (player.active) {
              this.wss.in(player.userId).emit('throwCardRes', {
                tableId: table.tableId,
                myPlayerId: player.playerId,
                gameStatus: table.gameStatus,
                playerId: table.players[playerIndex].playerId,
                card,
                serverTime: dayjs().toISOString(),
              });
            }
          }),
        );
        if (table.turnNo % 4 === 0) {
          table.firstCard = card;
        } else {
          const flag = this.commonService.canBeFirstCard(
            table.firstCard as Card,
            card,
          );
          if (flag === true) {
            table.firstCard = card;
          } else if (table.leadCard) {
            const flag2 = this.commonService.canBeLeadCard(
              table.leadCard as Card,
              card,
            );
            if (flag2 === true) {
              table.leadCard = card;
            } else {
            }
          } else {
            const flag1 = this.commonService.canAddLeadCard(
              table.firstCard as Card,
              card,
            );
            if (flag1 === true) {
              table.leadCard = card;
            }
          }
        }
        table.turnNo = table.turnNo + 1;
        const nextPlayer = this.tableService.getNextPlayer(table) as PlayerInfo;
        table.currentTurn = nextPlayer?.playerId;
        table.updatedAt = dayjs().toISOString();
        await this.tableService.storeTable(table);
        await (table.gameStatus === GameStatus.playing &&
        table.turnNo % 4 === 0 &&
        table.turnNo > 6
          ? this.endHand(table.tableId)
          : this.throwCard(table.tableId));
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      this.logger.log(
        `ERROR in throwCard Event. Table ID: ${tableId}, User ID: ${userId}`,
      );
      console.log('OnThrowCardEvent', error);
      throw error;
    } finally {
      await this.redisService.releaseLock(userId);
      if (tableId) {
        await this.redisService.releaseLock(tableId);
      }
    }
  }

  @WsSubscribeMessage('scoreboard')
  async onScoreboardEvent(@WsUserID() userId: string) {
    let tableId;
    try {
      tableId = await this.transientDBService.getUserActiveTableId(userId);
      if (tableId) {
        await this.redisService.aquireLock(tableId);
        const table = await this.tableService.getTableOrThrowException(tableId);
        const scoreboardData = await this.commonService.getScoreboard(tableId);
        const index = table.players.findIndex(
          (player) => player.userId === userId,
        );
        this.wss.in(userId).emit('scoreboardRes', {
          ...scoreboardData,
          myPlayerId: table.players[index].playerId,
        });
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      this.logger.log(
        `ERROR in Scoreboard. Table ID: ${tableId}, User ID: ${userId}`,
      );
      throw error;
    } finally {
      if (tableId) {
        await this.redisService.releaseLock(tableId);
      }
    }
  }

  async joinTable(table: Table, userId: string) {
    this.logger.debug(`Game Play log ${table.tableId}: joinTable ${userId}`);
    try {
      await Promise.all(
        table.players.map(async (player) => {
          if (player.userId === userId) {
            table.myPlayerId = player.playerId;
            this.wss
              .in(player.userId)
              .socketsJoin([table.tableId, table.tableType.tableTypeId]);
            if (player.active) {
              this.wss.in(player.userId).emit('joinTableRes', {
                table,
                accepted: true,
                timeout: table.timeout,
                serverTime: dayjs().toISOString(),
              });
            }
            delete table.myPlayerId;
          } else {
            if (player.active) {
              this.wss.in(player.userId).emit('playerJoined', {
                player: table.players.at(-1),
                tableId: table.tableId,
              });
            }
          }
        }),
      );
      table.updatedAt = dayjs().toISOString();
      // If players number are 4, game should be started.
      if (table.players.length === 4) {
        table.players.sort((player1, player2) =>
          player1.playerId.localeCompare(player2.playerId, undefined, {
            numeric: true,
          }),
        );
        table.gameStatus = GameStatus.roundStarted;
        await this.tableService.storeTable(table);
        await this.tableService.removeWaitingTable(table);
        await this.gameStart(table.tableId);
      } else {
        await this.tableService.storeTable(table);
      }
    } catch {
      this.logger.log(
        `ERROR in Join Table, Table ID: ${table.tableId}, User ID: ${userId}`,
      );
    }
  }

  async deleteTable(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: deleteTable`);
    try {
      await this.redisService.aquireLock(tableId);
      const table = await this.tableService.getTableOrThrowException(tableId);
      if (table.gameStatus === GameStatus.waiting && table.players.length < 4) {
        // Store expired users for notifications
        table.players.map(async (player) => {
          if (
            Number(table.tableType.amount) >=
            Number(
              this.configService.getCbrMatchMakingNotificationConfig()
                .minimumJoinAmountForNotifications,
            )
          ) {
            await this.transientDBService.setBigTableUser(player.userId);
          }

          if (player.active) {
            this.wss.in(player.userId).emit('matchingTimeoutRes', {
              timeout: table.timeout,
              serverTime: dayjs().toISOString(),
            });
          }
        });
        table.players.map((player) => {
          if (player.active) {
            this.wss.in(player.userId).socketsLeave(table.tableId);
            this.wss
              .in(player.userId)
              .socketsLeave((table?.tableType as TableType).tableTypeId);
          }
        });
        await this.tableService.removeTable(table);
        await this.tableService.removeWaitingTable(table);
      } else {
      }
    } catch (error) {
      this.logger.log('ERROR in Delete Table.', tableId, error);
      throw new BadRequestException('Error: ', error);
    } finally {
      await this.redisService.releaseLock(tableId);
    }
  }

  async gameStart(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: game`);
    await this.redisService.aquireLock(tableId);
    const table = await this.tableService.getTableOrThrowException(tableId);

    const userIds: string[] = [];
    table.players.map(async (player) => {
      userIds.push(player.userId);
    });
    try {
      if (table.tableType.amount === '0') {
        // update free games per day for each pro player
        console.log('tableTypeAmount', table.tableType.amount);
        await Promise.all(
          table.players.map(async (player) => {
            await this.commonService.updatePlayedFreeGames(player.userId);
          }),
        );
      } else {
        // debit joinFee from players
        await this.commonService.debitTable(
          userIds,
          table.tableType.amount,
          table.tableId,
        );
      }

      // Delete already-joined users from BigTable
      await Promise.all(
        userIds.map(async (userId) => {
          if (
            Number(table.tableType.amount) >=
            Number(
              this.configService.getCbrMatchMakingNotificationConfig()
                .minimumJoinAmountForNotifications,
            )
          ) {
            await this.transientDBService.deleteBigTableUser(userId);
          }
        }),
      );

      // Round Start
      await this.startRound(table.tableId);
    } catch (error) {
      this.logger.log('ERROR in GameStart.', tableId, error);
      throw new BadRequestException('Error: ', error);
    } finally {
      await this.redisService.releaseLock(tableId);
    }
  }

  async startRound(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: startRound`);
    const table = await this.tableService.getTableOrThrowException(tableId);

    const tables = this.configService.getCbrTables();
    const tableType = tables.find(
      (tableConfig) => tableConfig.tableTypeId === table.tableType.tableTypeId,
    );
    if (!tableType) {
      throw new BadRequestException(
        `No Table Type with id ${table.tableType.tableTypeId}`,
      );
    }
    const tableTypeConfig = tables.find(
      (table: any) => table.tableTypeId === tableType.tableTypeId,
    );

    if (!isEqual(tableType, tableTypeConfig)) {
      throw new BadRequestException('tableType is inconsistent with config');
    }

    try {
      console.log('tableTypeAmount', tableType.amount);

      table.roundNo = table.roundNo + 1;

      // initialize table
      table.dealerId =
        table.roundNo === 1
          ? PlayerId.pl1
          : this.tableService.getNextRoundDealer(table);
      table.currentTurn = table.dealerId;
      const timeout = dayjs()
        .add(config.cbrGameplay.timeout.startTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      table.players.map((player) => {
        delete player?.cards;
        player.handBid = 0;
        player.currentHand = 0;
        delete player?.currentCard;
      });
      table.handNo = 1;
      table.gameStatus = GameStatus.roundStarted;
      table.turnNo = 0;
      if (table.roundNo === 1) {
        table.roundStartedAt = dayjs().toDate();
      }
      table.updatedAt = dayjs().toISOString();
      await this.tableService.storeTable(table);

      const dealer = this.tableService.getDealerId(table);
      table.players.map(async (player) => {
        if (player.active) {
          this.wss.in(player.userId).emit('roundStarted', {
            tableId: table.tableId,
            myPlayerId: player.playerId,
            roundNo: table.roundNo,
            totalRounds: table.totalRounds,
            dealerId: dealer.playerId,
            tableType: table.tableType,
            winAmount: table.tableType.winnings,
            gameStatus: table.gameStatus,
            players: table.players,
            roundStartedAt: dayjs().toISOString(),
            timeout,
            serverTime: dayjs().toISOString(),
          });
        }
      });
      this.cbrQueueService.addTimeoutAction(
        table.tableId,
        GameAction.dealCards,
        config.cbrGameplay.timeout.startTimeout,
      );
    } catch (error) {
      this.logger.log('ERROR in StartRound.', tableId, error);
      throw error;
    } finally {
    }
  }

  /**
   * Dealing cards after initial betting of the table
   */
  async dealCards(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: dealCards`);
    await this.redisService.aquireLock(tableId);
    const table = await this.tableService.getTableOrThrowException(tableId);
    try {
      const dealtTable = (await this.tableService.dealCards(table)) as Table;
      const timeout = dayjs()
        .add(config.cbrGameplay.timeout.handBidTimeout, 'second')
        .toISOString();
      dealtTable.timeout = timeout;

      await Promise.all(
        dealtTable.players.map(async (player) => {
          const cards: Card[] = [];
          player.cards?.map((card) => {
            cards.push(card.card);
          });
          if (player.active) {
            this.wss.in(player.userId).emit('dealCards', {
              tableId: dealtTable.tableId,
              roundNo: dealtTable.roundNo,
              gameStatus: dealtTable.gameStatus,
              myPlayerId: player.playerId,
              totalScore: player.totalScore || 0,
              cards,
              serverTime: dayjs().toISOString(),
              timeout,
            });
          }
        }),
      );
      table.updatedAt = dayjs().toISOString();
      await this.tableService.storeTable(dealtTable);
      const payload = {
        turnNo: table.turnNo,
        auto: true,
      };
      this.cbrQueueService.addTimeoutAction(
        table.tableId,
        GameAction.afterDealCards,
        config.cbrGameplay.timeout.handBidTimeout,
        payload,
      );
    } catch (error) {
      this.logger.log('ERROR in DealCards.', tableId, error);
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId);
    }
  }

  async handBid(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: handBid`);
    try {
      const table = await this.tableService.getTableOrThrowException(tableId);
      const currentPlayer: PlayerInfo = table.players.find(
        (player) => player.playerId === table.currentTurn,
      ) as PlayerInfo;
      table.gameStatus = GameStatus.handBid;
      table.updatedAt = dayjs().toISOString();
      if (currentPlayer.active) {
        const timeout = dayjs()
          .add(config.cbrGameplay.timeout.actionTimeout, 'second')
          .toISOString();
        table.players.map(async (player) => {
          if (player.active) {
            this.wss.in(player.userId).emit('handBidTurn', {
              tableId: table.tableId,
              myPlayerId: player.playerId,
              gameStatus: table.gameStatus,
              playerId: currentPlayer.playerId,
              serverTime: dayjs().toISOString(),
              timeout,
            });
          }
        });
        table.timeout = timeout;
        const payload = {
          turnNo: table.turnNo,
          auto: false,
        };
        await this.tableService.storeTable(table);
        this.cbrQueueService.addTimeoutAction(
          table.tableId,
          GameAction.handBid,
          config.cbrGameplay.timeout.actionTimeout,
          payload,
        );
      } else {
        const timeout = dayjs()
          .add(config.cbrGameplay.timeout.autoTimeout, 'second')
          .toISOString();
        table.players.map(async (player) => {
          if (player.active) {
            this.wss.in(player.userId).emit('handBidTurn', {
              tableId: table.tableId,
              myPlayerId: player.playerId,
              playerId: currentPlayer.playerId,
              gameStatus: table.gameStatus,
              serverTime: dayjs().toISOString(),
              timeout,
            });
          }
        });
        table.updatedAt = dayjs().toISOString();
        table.timeout = timeout;
        await this.tableService.storeTable(table);

        const payload = {
          turnNo: table.turnNo,
          auto: true,
        };

        this.cbrQueueService.addTimeoutAction(
          table.tableId,
          GameAction.handBid,
          config.cbrGameplay.timeout.autoTimeout,
          payload,
        );
      }
    } catch (error) {
      this.logger.log('ERROR in HandBid.', tableId, error);
      throw error;
    } finally {
    }
  }

  async autoHandBid(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: autoHandBid`);
    try {
      await this.redisService.aquireLock(tableId);
      const table = await this.tableService.getTableOrThrowException(tableId);
      if (table.gameStatus !== GameStatus.handBid) {
        throw new BadRequestException('Not the HandBid Status');
      }
      const playerIndex = table.players.findIndex(
        (player) => player.playerId === table.currentTurn,
      );
      table.players[playerIndex].handBid = 1;

      table.players.map(async (player) => {
        if (player.active) {
          this.wss.in(player.userId).emit('handBidRes', {
            tableId: table.tableId,
            myPlayerId: player.playerId,
            gameStatus: table.gameStatus,
            turnNo: table.turnNo,
            playerId: table.players[playerIndex].playerId,
            hand: 1,
            serverTime: dayjs().toISOString(),
          });
        }
      });

      table.turnNo = table.turnNo + 1;
      const nextPlayer = this.tableService.getNextPlayer(table) as PlayerInfo;
      table.currentTurn = nextPlayer?.playerId;
      table.updatedAt = dayjs().toISOString();
      await this.tableService.storeTable(table);
      if (table.turnNo === 4) {
        // table.gameStatus = GameStatus.playing;
        await this.tableService.storeTable(table);
        await delay(2000);
        await this.throwCard(table.tableId);
      } else {
        await this.handBid(tableId);
      }
    } catch (error) {
      this.logger.log('ERROR in Auto HandBid.', tableId, error);
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId);
    }
  }

  async endHand(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: endHand`);
    try {
      await delay(2000);
      const table = await this.tableService.getTableOrThrowException(tableId);
      const winnerId = this.commonService.getWinner(table);
      let winnerHandBid: number;
      let winnerHandScore: number;
      table.players.map((player) => {
        if (player.playerId === winnerId) {
          winnerHandBid = player.handBid;
          winnerHandScore = player.currentHand + 1;
        }
      });
      const timeout = dayjs()
        .add(config.cbrGameplay.timeout.endHandTimeout, 'second')
        .toISOString();
      table.players.map(async (player) => {
        if (player.playerId === winnerId) {
          player.currentHand = player.currentHand + 1;
        }
        if (player.active) {
          this.wss.in(player.userId).emit('handEnded', {
            tableId: table.tableId,
            myPlayerId: player.playerId,
            handNo: table.handNo,
            handBid: winnerHandBid,
            handScore: winnerHandScore,
            winnerId,
            serverTime: dayjs().toISOString(),
            timeout,
          });
        }
        delete player.currentCard;
      });
      delete table.firstCard;
      delete table.leadCard;
      table.dealerId = winnerId;
      table.currentTurn = table.dealerId;
      table.handNo = table.handNo + 1;
      table.timeout = timeout;
      table.updatedAt = dayjs().toISOString();
      await this.tableService.storeTable(table);

      if (table.handNo === 14) {
        // table.gameStatus = GameStatus.roundEnded;
        await this.tableService.storeTable(table);
        this.cbrQueueService.addTimeoutAction(
          table.tableId,
          GameAction.roundEnded,
          config.cbrGameplay.timeout.endHandTimeout,
        );
      } else {
        this.cbrQueueService.addTimeoutAction(
          table.tableId,
          GameAction.nextHand,
          config.cbrGameplay.timeout.endHandTimeout,
        );
      }
    } catch (error) {
      this.logger.log('ERROR in EndHand', tableId, error);
      throw error;
    } finally {
    }
  }

  async throwCard(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: throwCard`);
    try {
      const table = await this.tableService.getTableOrThrowException(tableId);
      const currentPlayer: PlayerInfo = table.players.find(
        (player) => player.playerId === table.currentTurn,
      ) as PlayerInfo;
      table.gameStatus = GameStatus.playing;
      table.updatedAt = dayjs().toISOString();
      if (currentPlayer.active) {
        const cards = this.commonService.getPossibleCards(
          table,
          currentPlayer.playerId,
        );
        table.players.map(async (player) => {
          if (player.playerId === currentPlayer.playerId && player.active) {
            this.wss.in(player.userId)?.emit('playerTurnRes', {
              tableId: table.tableId,
              playerId: currentPlayer.playerId,
              myPlayerId: player.playerId,
              handNo: table.handNo,
              gameStatus: table.gameStatus,
              cards,
              serverTime: dayjs().toISOString(),
              timeout: dayjs()
                .add(config.cbrGameplay.timeout.actionTimeout, 'second')
                .toISOString(),
            });
          } else {
            if (player.active) {
              this.wss.in(player.userId)?.emit('playerTurnRes', {
                tableId: table.tableId,
                playerId: currentPlayer.playerId,
                myPlayerId: player.playerId,
                handNo: table.handNo,
                gameStatus: table.gameStatus,
                serverTime: dayjs().toISOString(),
                timeout: dayjs()
                  .add(config.cbrGameplay.timeout.actionTimeout, 'second')
                  .toISOString(),
              });
            }
          }
        });
        table.timeout = dayjs()
          .add(config.cbrGameplay.timeout.actionTimeout, 'second')
          .toISOString();
        await this.tableService.storeTable(table);
        const payload = {
          turnNo: table.turnNo,
          auto: false,
        };
        this.cbrQueueService.addTimeoutAction(
          tableId,
          GameAction.throwCard,
          config.cbrGameplay.timeout.actionTimeout,
          payload,
        );
      } else {
        const timeout = dayjs()
          .add(config.cbrGameplay.timeout.autoTimeout, 'second')
          .toISOString();
        table.players.map(async (player) => {
          if (player.active) {
            this.wss.in(player.userId).emit('playerTurnRes', {
              tableId: table.tableId,
              playerId: currentPlayer.playerId,
              myPlayerId: player.playerId,
              gameStatus: table.gameStatus,
              serverTime: dayjs().toISOString(),
              timeout: dayjs()
                .add(config.cbrGameplay.timeout.actionTimeout, 'second')
                .toISOString(),
            });
          }
        });
        table.timeout = timeout;
        await this.tableService.storeTable(table);
        const payload = {
          turnNo: table.turnNo,
          auto: true,
        };
        this.cbrQueueService.addTimeoutAction(
          table.tableId,
          GameAction.throwCard,
          config.cbrGameplay.timeout.autoTimeout,
          payload,
        );
      }
    } catch (error) {
      this.logger.log('ERROR in ThrowCard.', tableId, error);
      throw error;
    } finally {
    }
  }

  async autoThrowCard(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: autoThrowCard`);

    try {
      await this.redisService.aquireLock(tableId);
      const table = await this.tableService.getTableOrThrowException(tableId);
      if (table.gameStatus !== GameStatus.playing) {
        throw new BadRequestException('Not the Throw Card Status');
      }
      const playerIndex = table.players.findIndex(
        (player) => player.playerId === table.currentTurn,
      );
      const card = this.commonService.getAutoThrowCard(table);

      table.players[playerIndex].currentCard = card;

      table.players[playerIndex].cards?.map((gameCard) => {
        if (gameCard.card === card) {
          gameCard.thrown = true;
        }
      });
      table.players.map(async (player) => {
        if (player.active) {
          this.wss.in(player.userId).emit('throwCardRes', {
            tableId: table.tableId,
            myPlayerId: player.playerId,
            playerId: table.currentTurn,
            gameStatus: table.gameStatus,
            serverTime: dayjs().toISOString(),
            card,
          });
        }
      });

      table.turnNo = table.turnNo + 1;
      const nextPlayer = this.tableService.getNextPlayer(table) as PlayerInfo;
      table.currentTurn = nextPlayer?.playerId;
      if (table.turnNo % 4 === 1) {
        table.firstCard = card;
      } else {
        const flag = this.commonService.canBeFirstCard(
          table.firstCard as Card,
          card,
        );
        if (flag === true) {
          table.firstCard = card;
        } else if (table.leadCard) {
          const flag2 = this.commonService.canBeLeadCard(
            table.leadCard as Card,
            card,
          );
          if (flag2 === true) {
            table.leadCard = card;
          } else {
          }
        } else {
          const flag1 = this.commonService.canAddLeadCard(
            table.firstCard as Card,
            card,
          );
          if (flag1 === true) {
            table.leadCard = card;
          }
        }
      }
      table.updatedAt = dayjs().toISOString();
      await this.tableService.storeTable(table);
      await (table.gameStatus === GameStatus.playing &&
      table.turnNo % 4 === 0 &&
      table.turnNo > 6
        ? this.endHand(table.tableId)
        : this.throwCard(table.tableId));
    } catch (error) {
      this.logger.log('ERROR in Auto ThrowCard.', tableId, error);
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId);
    }
  }

  async endRound(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: endRound`);
    await this.redisService.aquireLock(tableId);
    const table = await this.tableService.getTableOrThrowException(tableId);
    try {
      table.players.map(async (player) => {
        player.roundScore = this.commonService.getRoundScore(
          player.currentHand,
          player.handBid,
        );
        player.scores[table.roundNo - 1] = player.roundScore;
        player.totalScore = Big(player.totalScore)
          .add(player.roundScore)
          .toString();

        if (player.active) {
          this.wss.in(player.userId).emit('roundEnded', {
            tableId: table.tableId,
            gameStatus: table.gameStatus,
            roundNo: table.roundNo,
            serverTime: dayjs().toISOString(),
          });
        }
      });
      table.turnNo = 0;
      table.gameStatus = GameStatus.roundEnded;
      table.updatedAt = dayjs().toISOString();
      await this.tableService.storeTable(table);
      const scoreboardData = await this.commonService.getScoreboard(
        table.tableId,
      );
      table.players.map((player) => {
        if (player.active) {
          this.wss.in(player.userId).emit('scoreboardRes', {
            ...scoreboardData,
            myPlayerId: player.playerId,
          });
        }
      });
      if (table.roundNo === table.totalRounds) {
        table.gameStatus = GameStatus.gameEnded;
        await this.tableService.storeTable(table);
        this.cbrQueueService.addTimeoutAction(
          tableId,
          GameAction.endGame,
          config.cbrGameplay.timeout.gameEndDelay,
        );
      } else {
        // Start New Round
        this.cbrQueueService.addTimeoutAction(
          table.tableId,
          GameAction.startRound,
          config.cbrGameplay.timeout.roundEndTimeout,
        );
      }
    } catch (error) {
      this.logger.log('ERROR in EndRound', tableId, error);
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId);
    }
  }

  async gameEnded(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: gameEnded`);
    const table = await this.tableService.getTableOrThrowException(tableId);
    table.updatedAt = dayjs().toISOString();
    await this.tableService.storeTable(table);

    try {
      const { winners, amount } = this.tableService.getGameWinners(table);
      const winLoseAmount = Number(amount).toFixed(2);
      const players: PlayerGameEndInfo[] = [];
      await Promise.all(
        table.players.map((player) => {
          if (winners.includes(player.playerId)) {
            players.push({
              playerId: player.playerId,
              name: player.playerInfo.name || player.playerInfo.username,
              avatar: player.playerInfo.avatar,
              totalScore: player.totalScore,
              winAmount: winLoseAmount,
              isWinner: true,
            });
          } else {
            players.push({
              playerId: player.playerId,
              name: player.playerInfo.name || player.playerInfo.username,
              avatar: player.playerInfo.avatar,
              totalScore: player.totalScore,
              winAmount: table.tableType.amount,
              isWinner: false,
            });
          }
        }),
      );
      this.wss.in(table.tableId).emit('gameEnded', {
        players,
        winners,
        amount: winLoseAmount,
        serverTime: dayjs().toISOString(),
      });

      table.players.map((player) => {
        if (player.active) {
          this.wss.in(player.userId).socketsLeave(table.tableId);
          this.wss
            .in(player.userId)
            .socketsLeave((table?.tableType as TableType).tableTypeId);
        }
      });
      await this.cbrGameplayService.endGame(tableId);
      await this.emitUserCount();
    } catch (error) {
      this.logger.log('ERROR in GameEnded. ', tableId, error);
    } finally {
    }
  }
  /**
   * Request to Leave Game Table
   */
  @WsSubscribeMessage('leaveTable')
  async onLeaveTableEvent(@WsUserID() userId: string) {
    let tableId;
    try {
      await this.redisService.aquireLock(userId);
      tableId = await this.transientDBService.getUserActiveTableId(userId);

      if (tableId) {
        await this.redisService.aquireLock(tableId);
        const table = await this.tableService.getTableOrThrowException(tableId);
        let playerId;
        if (table.gameStatus === GameStatus.waiting) {
          playerId = await this.cbrGameplayService.leaveTableInWaiting(
            table.tableType.tableTypeId,
            tableId,
            userId,
          );
          if (
            playerId === PlayerId.pl1 ||
            playerId === PlayerId.pl2 ||
            playerId === PlayerId.pl3 ||
            playerId === PlayerId.pl4
          ) {
            this.wss.in(tableId).emit('playerLeftTable', {
              accepted: true,
              tableId,
              playerId,
              serverTime: dayjs().toISOString(),
            });
            this.wss.in(userId).socketsLeave(tableId);
            this.wss
              .in(userId)
              .socketsLeave((table?.tableType as TableType).tableTypeId);
          } else {
            this.wss.in(userId).emit('leftTableRes', {
              accepted: false,
              tableId,
              serverTime: dayjs().toISOString(),
            });
          }
        } else if (table.gameStatus === GameStatus.gameEnded) {
          throw new BadRequestException(
            'Cannot leave during game result processing',
          );
        } else {
          let leftPlayerIndex: number = -1;

          await Promise.all(
            table.players.map(async (player, index) => {
              if (player.userId === userId) {
                player.active = false;
                playerId = player.playerId;
                leftPlayerIndex = index;
              }
            }),
          );

          if (leftPlayerIndex !== -1) {
            table.players[leftPlayerIndex].active = false;
          }

          await this.transientDBService.deleteUserActiveTableId(userId);
          if (
            playerId === PlayerId.pl1 ||
            playerId === PlayerId.pl2 ||
            playerId === PlayerId.pl3 ||
            playerId === PlayerId.pl4
          ) {
            this.wss.in(tableId).emit('playerLeftTable', {
              accepted: true,
              tableId,
              playerId,
              serverTime: dayjs().toISOString(),
            });
            this.wss.in(userId).socketsLeave(tableId);
            this.wss
              .in(userId)
              .socketsLeave((table?.tableType as TableType).tableTypeId);
          } else {
            this.wss.in(userId).emit('leftTableRes', {
              accepted: false,
              tableId,
              serverTime: dayjs().toISOString(),
            });
          }

          let activeUserNumber = 0;
          await Promise.all(
            table.players.map((player) => {
              if (player.active) {
                activeUserNumber++;
              }
            }),
          );
          table.updatedAt = dayjs().toISOString();
          await this.tableService.storeTable(table);
          if (activeUserNumber === 1) {
            table.gameStatus = GameStatus.gameEnded;
            table.updatedAt = dayjs().toISOString();
            await this.tableService.storeTable(table);
            await this.gameEnded(tableId);
          }
        }
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      this.wss.in(userId).emit('playerLeftTable', {
        accepted: false,
        serverTime: dayjs().toISOString(),
        error: error,
      });
      this.logger.log('ERROR in leftTable', userId, error);
      throw error;
    } finally {
      await this.redisService.releaseLock(userId);
      if (tableId) {
        await this.redisService.releaseLock(tableId);
      }
    }
  }

  /**
   * Check if the user had been already matched with other users
   */
  @WsSubscribeMessage('checkIfJoined')
  async onCheckIfJoined(client: ExtendedSocket) {
    const { user } = client;
    const userId = user.userId;
    const status = await this.commonService.checkIfJoined(userId);

    client.emit('checkIfJoinedRes', { status });
  }

  async broadcastOnlineUserCount() {
    // Add fetchSockets In
    const clients: ExtendedSocket[] =
      (await this.wss.fetchSockets()) as ExtendedSocket[];
    const actualCount = clients ? clients.length : 0;
    this.wss.emit('onlineUserCountRes', { count: actualCount });
  }

  /**
   * Send emoji to opponent players
   */
  @WsSubscribeMessage('sendEmoji')
  async onSendEmojiEvent(
    @WsUserID() userId: string,
    @WsData(EmojiData) emojiData: EmojiData,
  ) {
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    if (tableId) {
      const table = await this.tableService.getTableOrThrowException(tableId);
      await Promise.all(
        table.players.map(async (player) => {
          if (player.active) {
            this.wss
              .in(player.userId)
              .emit('deliverEmoji', { tableId, ...emojiData });
          }
        }),
      );
    }
  }

  /**
   * Send message to opponent players
   */
  @WsSubscribeMessage('sendMessage')
  async onSendMessagEvent(
    @WsUserID() userId: string,
    @WsData(MessageData) messageData: MessageData,
  ) {
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    if (tableId) {
      const table = await this.tableService.getTableOrThrowException(tableId);
      await Promise.all(
        table.players.map(async (player) => {
          if (player.active) {
            this.wss
              .in(player.userId)
              .emit('deliverMessage', { tableId, ...messageData });
          }
        }),
      );
    }
  }

  async destroyInactiveTable(tableId: string) {
    this.logger.debug(`Game Play log ${tableId}: destroyInactiveTable`);
    // reward last amounts
    const table = (await this.tableService.getTable(tableId)) as Table;
    if (!table) {
      throw new BadRequestException('Inactive Table to destroy does not exist');
    }
    table.players.map(async (player) => {
      if (player.active) {
        this.wss.in(player.userId).emit('playerLeftTable', {
          tableId: table.tableId,
          accepted: true,
          playerId: player.playerId,
          serverTime: dayjs().toISOString(),
        });
        this.wss.in(player.userId).socketsLeave(tableId);
        this.wss.in(player.userId).socketsLeave(table.tableType.tableTypeId);
        await this.emitUserCount();
      }
    });
    await this.commonService.endStuckTable(table);
    await this.tableService.removeTable(table);
  }

  /**
   * Get Online User Count
   */
  @WsSubscribeMessage('getUserCount')
  async getUserCount(client: ExtendedSocket) {
    const tables = [];
    const gameTables = this.configService.getCbrTables();
    for (const table of gameTables) {
      const clients: ExtendedSocket[] = (await this.wss
        .in(table.tableTypeId)
        .fetchSockets()) as ExtendedSocket[];
      const number = clients.length;
      const userCount = {
        tableTypeId: table.tableTypeId,
        userCount: number,
      };
      tables.push(userCount);
    }
    client.emit('allUserCount', { tables });
  }

  async emitUserCount() {
    const tables = this.configService.getCbrTables();
    const tablesTypes: any = [];
    for (const table of tables) {
      const clients: ExtendedSocket[] = (await this.wss
        .in(table.tableTypeId)
        .fetchSockets()) as ExtendedSocket[];
      const number = clients.length;
      tablesTypes.push({ ...table, userCount: number });
    }
    this.wss.emit('allUserCount', { tables: tablesTypes });
  }

  async sendMatchMakingPushNotification(userIds: string[], joinFee: string) {
    const pnTitle = 'Play Now ‼️';
    const pnContent = `Oh no! You could not find a player. Don't worry. 😊
    Players are now available 🙋 at the ${joinFee} table. 😍
    Tap here to play! ✌️`;
    const deepLink = `emp://Callbreak/JoinTable=${joinFee}`;
    await this.notificationProvider.sendMassPushNotifications(
      userIds,
      pnTitle,
      pnContent,
      deepLink,
    );
  }

  async sendMatchMakingSocketNotification(userIds: string[], joinFee: string) {
    const deepLink = `emp://Callbreak/JoinTable=${joinFee}`;
    await this.socketGatewayProvider.sendMatchMakingSocketNotification(
      userIds,
      deepLink,
    );
  }
}
