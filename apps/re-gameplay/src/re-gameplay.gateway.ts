/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unicorn/consistent-destructuring */
import { Server, Socket } from 'socket.io';
import * as dayjs from 'dayjs';
import Big from 'big.js';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UseGuards,
  UsePipes,
  forwardRef,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  WsClient,
  WsData,
  WsSubscribeMessage,
} from '@lib/fabzen-common/decorators/ws.decorator';
import {
  GameLog,
  LogType,
  PlayerGameInfo,
  Table,
  TableType,
  SocketID,
  TableID,
  UserID,
  ExtendedSocket,
} from '@lib/fabzen-common/types';
import { JSONParserPipe } from '@lib/fabzen-common/pipes/json-parser.pipe';
import { verifyJwtTokenInSocketIo } from '@lib/fabzen-common/utils/jwt.util';
import { WsMaintenanceGuard } from '@lib/fabzen-common/guards/ws-maintenance.guard';
// import { UserGuard } from '@lib/fabzen-common/guards/ws-user.guard';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

import { WsJwtGuard } from '@lib/fabzen-common/guards/ws-jwt.guard';
import { ReGameplayController } from './re-gameplay.controller';
import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { CommonService, TableService } from './services/gameplay';
import {
  calculateScore,
  getAmount,
  getCardInfo,
  getReMatchingTimeout,
  leaveLogs,
  sortCardsByNumber,
} from './utils/re-gameplay.utils';
import { ReQueueService, WaitingTableQueueService } from './services/queue';
import { config } from '@lib/fabzen-common/configuration';
import { RedisService } from './services/transient-db/redis/service';
import { indexOf, isEqual, result } from 'lodash';
import {
  DeclareRequest,
  DiscardRequest,
  DrawRequest,
  EmojiData,
  FinishDeclarationRequest,
  FlushTableRequest,
  GroupRequest,
  JoinTableRequest,
  MessageData,
} from './re-gameplay.dto';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { AuthenticatedSocket } from '@lib/fabzen-common/types/socket.types';
import {
  PlayerInfo,
  ReCard,
  ReGameLog,
  ReGameStatus,
  ReTable,
  ReTableType,
  ReTableWithPid,
  NumberOfCardsPerPlayer,
  ReCardsGroup,
  MaxCardsPerGroup,
  ReGroupState,
  RePlayerId,
  ReDeclarationResult,
  GameAction,
  Status,
} from './re-gameplay.types';
import { customAlphabet } from 'nanoid';
import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';

@UseGuards(WsJwtGuard)
@UsePipes(new JSONParserPipe())
@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ReGameplayGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() wss!: Server;
  private readonly logger = new FbzLogger(ReGameplayGateway.name);

  constructor(
    @Inject(forwardRef(() => ReGameplayController))
    private readonly reGameplayController: ReGameplayController,
    @Inject(forwardRef(() => RedisTransientDBService))
    private readonly transientDBService: RedisTransientDBService,
    @Inject(forwardRef(() => WaitingTableQueueService))
    private readonly waitingTableQueueService: WaitingTableQueueService,
    @Inject(forwardRef(() => CommonService))
    private readonly commonService: CommonService,
    @Inject(forwardRef(() => RedisService))
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => TableService))
    private readonly tableService: TableService,
    @Inject(forwardRef(() => ReQueueService))
    private readonly reQueueService: ReQueueService,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  /**
   * Socket Connection Handler
   *
   * 1. Verify JWT
   *    - Inject user id and role in socket object on SUCCESS
   *    - Throw UnauthorizedException and disconnect the socket on FAILURE
   * 2. Send server time to allow the frontend to sync with backend
   * 3. Broadcast current online user count
   * 4. Send reconnection message if the user was disconnected in waiting or active state
   * 5. If same user (number) is already connected, force disconnect to ensure only one device is connected with the same number
   */
  async handleConnection(client: Socket) {
    verifyJwtTokenInSocketIo(client);
    const { user, id: socketId } = client as AuthenticatedSocket;
    const userId = user.userId;
    // this.logger.debug(
    //   `Socket Connected: socketId = ${socketId} userId = ${userId}`,
    // );
    await this.commonService.lockUser(userId);

    try {
      client.emit('serverTime', { time: dayjs().toISOString() });

      // check this user has already joined table or not
      const {
        isReconnected,
        table,
        status,
        tableId,
        waitingInfo,
        prevClientId,
      } = await this.tableService.connected(userId, socketId);

      leaveLogs('reconnection info', {
        isReconnected,
        table,
        status,
        tableId,
        waitingInfo,
        prevClientId,
      });

      if (isReconnected) {
        if (status === ReGameStatus.waiting) {
          client.emit('reconnectGame', {
            gameStatus: status,
            tableType: waitingInfo?.tableType,
            matchingTime: {
              timeout: waitingInfo?.timeout,
              serverTime: dayjs().toISOString(),
            },
            isReconnected: true,
          });
        } else if (table) {
          client.join(table.tableId);
          const reconnectTableResponse =
            this.tableService.handleReTableResponse(table, userId);

          console.log('Reconnection Close Deck Cards', table.closedDeckCards);
          const closeDeckCard = table.closedDeckCards[0];
          const {
            tableId,
            dealerId,
            currentTurn,
            gameStatus,
            timeout,
            roundId,
            wildCard,
            openDeckCards,
          } = table;

          if (table.gameStatus === ReGameStatus.declareCards) {
            const players = table.players.map((player) => {
              const {
                playerId,
                playerInfo,
                cardsGroups,
                softDrop,
                drop,
                declare,
                score,
              } = player;

              const { userId, ...playerInfoData } = playerInfo;

              let status: Status = Status.active;
              if (player.late) {
                status = Status.waiting;
              } else if (player.softDrop) {
                status = Status.drop;
              }

              return player.playerId === table.firstDeclaredPlayer
                ? {
                    playerId,
                    declare,
                    status,
                    playerInfo: playerInfoData,
                    score,
                    cardGroups: cardsGroups,
                    winner: true,
                  }
                : {
                    playerId,
                    status,
                    declare,
                    playerInfo: playerInfoData,
                    score,
                    cardGroups: cardsGroups,
                    winner: false,
                  };
            });

            table.players.map((player) => {
              if (player.userId === userId) {
                const tableData = {
                  tableId,
                  dealerId,
                  myPlayerId: player.playerId,
                  currency: 'INR',
                  currentTurn,
                  gameStatus,
                  timeout,
                  serverTime: dayjs().toISOString(),
                  roundId,
                  wildCard,
                  openDeckCards,
                  players,
                };

                client.emit('reconnectGame', {
                  isReconnected: true,
                  gameStatus: table.gameStatus,
                  table: tableData,
                  closeDeckCard,
                  declareCard: table.declareCard,
                  tableType: table.tableType,
                });
              }
            });
          } else if (table.gameStatus === ReGameStatus.roundEnded) {
            const { winner, winningAmount } =
              await this.commonService.getRoundResult(table);
            const players: any[] = [];

            await Promise.all(
              table.players.map((player) => {
                const {
                  playerId,
                  cardsGroups,
                  score,
                  softDrop,
                  drop,
                  declare,
                  playerInfo,
                } = player;

                const { userId, ...playerInfoData } = playerInfo;

                let status: Status = Status.active;
                if (player.late) {
                  status = Status.waiting;
                } else if (player.softDrop) {
                  status = Status.drop;
                }

                if (player.userId === winner) {
                  players.push({
                    playerId,
                    score,
                    status,
                    declare,
                    playerInfo: playerInfoData,
                    cardGroups: cardsGroups,
                    winner: true,
                    amount: Big(winningAmount).toFixed(2),
                  });
                } else {
                  const amount = Big(player.score)
                    .mul(Big(table.tableType.pointValue))
                    .toFixed(2);

                  players.push({
                    playerId,
                    score,
                    status,
                    declare,
                    playerInfo: playerInfoData,
                    cardGroups: cardsGroups,
                    winner: false,
                    amount,
                  });
                }
              }),
            );

            await Promise.all(
              table.leftPlayers.map((leftPlayer) => {
                const amount = Big(leftPlayer.score)
                  .mul(Big(table.tableType.pointValue))
                  .toFixed(2);

                const { playerId, score, declare, playerInfo, cardsGroups } =
                  leftPlayer;

                const { userId, ...playerInfoData } = playerInfo;

                players.push({
                  playerId,
                  score,
                  status: Status.leave,
                  declare,
                  playerInfo: playerInfoData,
                  cardGroups: cardsGroups,
                  winner: false,
                  amount,
                });
              }),
            );

            table.players.map((player) => {
              if (player.userId === userId) {
                const tableData = {
                  tableId,
                  dealerId,
                  myPlayerId: player.playerId,
                  currency: 'INR',
                  currentTurn,
                  gameStatus,
                  timeout,
                  serverTime: dayjs().toISOString(),
                  roundId,
                  wildCard,
                  openDeckCards,
                  players,
                };

                client.emit('reconnectGame', {
                  isReconnected: true,
                  gameStatus: table.gameStatus,
                  table: tableData,
                  closeDeckCard,
                  declareCard: table.declareCard,
                  tableType: table.tableType,
                });
              }
            });
          } else {
            const players = table.players.map((player) => {
              const {
                playerId,
                playerInfo,
                cardsGroups,
                softDrop,
                drop,
                declare,
                score,
              } = player;

              const { userId, ...playerInfoData } = playerInfo;

              let status: Status = Status.active;
              if (player.late) {
                status = Status.waiting;
              } else if (player.softDrop) {
                status = Status.drop;
              }

              return {
                playerId,
                status,
                declare,
                playerInfo: playerInfoData,
                score,
                cardGroups: cardsGroups,
              };
            });

            table.players.map((player) => {
              if (player.userId === userId) {
                const tableData = {
                  tableId,
                  dealerId,
                  myPlayerId: player.playerId,
                  currency: 'INR',
                  currentTurn,
                  dropPoints: player.turnNo >= 1 ? '40' : '20',
                  gameStatus,
                  timeout,
                  serverTime: dayjs().toISOString(),
                  roundId,
                  wildCard,
                  openDeckCards,
                  players,
                };

                client.emit('reconnectGame', {
                  isReconnected: true,
                  gameStatus: table.gameStatus,
                  table: tableData,
                  closeDeckCard,
                  tableType: table.tableType,
                });
              }
            });
          }

          // leave logs
          leaveLogs(`Gameplay log ${tableId} ${GameLog.reconnectGame}`, {
            tableId,
            userId,
            action: GameLog.reconnectGame,
            type: LogType.response,
            payload: {
              ...reconnectTableResponse,
              isReconnected: true,
            },
          });
        } else {
          client.emit('reconnectGame', {
            gameStatus: status,
            tableId,
          });
        }
      } else {
        client.emit('reconnectGame', { isReconnected });
      }

      if (prevClientId) {
        this.wss.to(prevClientId).emit('forceLogout', {
          cause: 'Logged in from other device',
        });
        this.wss.in(prevClientId).disconnectSockets(true);
      }
    } catch (error) {
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  /**
   * Socket Disconnection Handler
   *
   * 1. Broadcast current online user count
   * 2. Clean up Redis
   */
  async handleDisconnect(client: ExtendedSocket) {
    const { user } = client;
    // const count = await this.transientDBService.incrementUserCount(
    //   config.spGameplay.redis.onlineCountKey,
    //   -1,
    // );
    // this.wss.emit('onlineUserCountRes', { count });
  }

  /**
   * Connection Check with ping-pong
   */
  @WsSubscribeMessage('ping')
  async onPing(@WsClient() client: ExtendedSocket) {
    await this.commonService.sendNotification('sdf', 'sdf');
    client.emit('res', { pingVal: '' });
  }

  async process1() {
    await this.redisService.deleteKey('test1', 'test1');
  }

  @WsSubscribeMessage('flushTable')
  async onFlushTable(
    @WsClient() client: ExtendedSocket,
    @WsData(FlushTableRequest) { tableId }: FlushTableRequest,
  ) {
    await this.destroyInactiveTable(tableId);

    leaveLogs('flushTable', { tableId });
    client.emit('flushTable', {
      message: `Table removed in Redis: ${tableId}`,
    });
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
   * Rummy Join Table
   */
  // @UseGuards(UserGuard)
  @UseGuards(WsMaintenanceGuard)
  @WsSubscribeMessage('joinTable')
  async onJoinTableEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(JoinTableRequest) { tableTypeId }: JoinTableRequest,
  ) {
    console.log(`Join Table Request. TableTypeId ${tableTypeId}`);
    const { user, id: socketId } = client;
    const userId = user.userId;
    // log user data

    await this.transientDBService.setUserSocketId(userId, socketId);

    // TODO: check if the tableType is correct
    const tableInfo = await this.remoteConfigService.getReTableInfos();

    const tableTypeConfig = tableInfo.find(
      (table: any) => table.tableTypeId === tableTypeId,
    );
    if (!tableTypeConfig) {
      throw new BadRequestException('tableType is inconsistent with config');
    }

    // check if wallet balance and amount is acceptable
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    try {
      const POINT_MULTIPLIER = '80';
      const amount = Big(tableTypeConfig.pointValue)
        .mul(Big(POINT_MULTIPLIER))
        .toString();

      const { walletBalance, subWallet } =
        await this.commonService.checkWalletBalance(userId, amount);
      const doubleJoined = await this.tableService.checkReDoubleJoin(
        tableTypeConfig,
        userId,
      );

      if (doubleJoined) {
        throw new BadRequestException(`Only one table can be joined at a time`);
      }

      if (Big(walletBalance.main).lt('0')) {
        throw new BadRequestException(`Wallet balance is not enough`);
      }

      if (Big(amount).lte(Big('0'))) {
        throw new BadRequestException(`Amount can not be negative`);
      }

      const matchingTimeout = tableTypeConfig.matchingTime;
      const currentTime = dayjs().toISOString();
      const timeout = dayjs().add(matchingTimeout, 'second').toISOString();

      this.wss.to(socketId).emit('matchingTime', {
        gameStatus: ReGameStatus.waiting,
        timeout,
        serverTime: currentTime,
      });

      const { key } = client.handshake.headers;
      const { maintenanceBypassKey } = config.auth;
      const isMaintenanceBypass = key === maintenanceBypassKey;

      await this.waitingTableQueueService.addToReQueue(
        tableTypeConfig,
        userId,
        subWallet,
        walletBalance,
        isMaintenanceBypass,
      );

      const matchingNo: string =
        await this.transientDBService.getUserMatchingCount(userId);
      if (matchingNo === '0') {
        await this.transientDBService.setUserMatchingCount(userId, 0);
        await this.transientDBService.incrementMatchingCount(userId, 1);
      } else {
        await this.transientDBService.incrementMatchingCount(userId, 1);
      }
      const currentMatchingNo: string =
        await this.transientDBService.getUserMatchingCount(userId);
      console.log('User Matching Try NO', currentMatchingNo);
      setTimeout(async () => {
        await this.reGameplayController.handleMatchingTime(
          userId,
          currentMatchingNo,
        );
      }, matchingTimeout * 1000);
    } catch (error) {
      // leave logs
      console.log(`Error in Join Table Request. TableTypeId ${tableTypeId}`);
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  /**
   * Rummy Draw Card
   */
  @WsSubscribeMessage('drawReq')
  async onDrawCardEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(DrawRequest) { card }: DrawRequest,
  ) {
    const userId = client.user.userId;
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    let tableId;
    try {
      tableId = await this.transientDBService.getUserActiveTableId(userId);
      console.log(`Draw Card Request. TableId: ${tableId} Card ${card}`);
      if (tableId) {
        await this.drawCard(tableId, userId, card as ReCard);
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      // leave logs
      console.log(
        `Error in Draw Card Request. TableId: ${tableId} Card ${card}`,
      );
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  /**
   * Rummy Discard Card
   */
  @WsSubscribeMessage('discardReq')
  async onDiscardCardEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(DiscardRequest) { card }: DiscardRequest,
  ) {
    const userId = client.user.userId;
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    let tableId;
    try {
      tableId = await this.transientDBService.getUserActiveTableId(userId);
      console.log(`Discard Card Request. TableId: ${tableId} Card ${card}`);
      if (tableId) {
        await this.discardCard(tableId, userId, card, false);
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      // leave logs
      console.log(
        `Error in Discard Card Request. TableId: ${tableId} Card ${card}`,
      );
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  /**
   * Rummy User Group Define
   */
  @WsSubscribeMessage('groupReq')
  async onGroupRequestEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(GroupRequest) { cardsGroups }: GroupRequest,
  ) {
    const userId = client.user.userId;
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    let tableId: string = '';
    try {
      tableId = (await this.transientDBService.getUserActiveTableId(
        userId,
      )) as string;
      console.log(`Group Request. TableId: ${tableId}`);
      if (tableId) {
        const isValid = await this.validateCardsGroup(
          tableId,
          userId,
          cardsGroups,
        );

        leaveLogs('group lock', { tableId });
        const { table, pid } =
          (await this.tableService.getReTableOrThrowException(
            tableId,
          )) as ReTableWithPid;
        leaveLogs('group lock release', { tableId, pid });
        await this.redisService.releaseLock(tableId, pid);

        table.updatedAt = dayjs().toISOString();

        const currentPlayer = table.players.find(
          (player) => player.userId === userId,
        );
        if (!currentPlayer) {
          throw new BadRequestException('The User does not exist!');
        }

        await Promise.all(
          table.players.map(async (player) => {
            if (player.userId === userId) {
              const socketId = (await this.transientDBService.getUserSocketId(
                player.userId,
              )) as SocketID;

              this.wss.to(socketId).emit('groupRes', {
                tableId: tableId,
                cardsGroups: currentPlayer.cardsGroups,
              });
            }
          }),
        );

        await this.tableService.updateReTable(table, pid);
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      // leave logs
      console.log(`Error in Group Request. TableId: ${tableId}`);
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  /**
   * Rummy Declaration Request
   */
  @WsSubscribeMessage('declareReq')
  async onDeclarationEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(DeclareRequest) { card, cardsGroups }: DeclareRequest,
  ) {
    const userId = client.user.userId;
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    let tableId: string = '';
    try {
      tableId = (await this.transientDBService.getUserActiveTableId(
        userId,
      )) as string;
      console.log(`Declaration Request. TableId: ${tableId} Card ${card}`);
      if (tableId) {
        leaveLogs('Declaration', { tableId });
        const { table, pid } =
          (await this.tableService.getReTableOrThrowException(
            tableId,
          )) as ReTableWithPid;
        leaveLogs('Declaration lock', { tableId, pid });
        await this.redisService.releaseLock(tableId, pid);

        if (table.firstDeclaredPlayer) {
          throw new BadRequestException('Cannot throw declaration request');
        }

        const currentPlayer = table.players.find(
          (player) => player.userId === userId,
        );
        if (currentPlayer && currentPlayer.late) {
          throw new BadRequestException('This player Cannot Declare Cards!');
        }

        console.log(
          `table turnNo: ${table.turnNo} before TableId: ${table.tableId}`,
        );
        await this.discardCard(tableId, userId, card, true);
        table.turnNo += 1;
        console.log(
          `table turnNo: ${table.turnNo} after TableId: ${table.tableId}`,
        );

        const isEqual = await this.validateCardsGroup(
          tableId,
          userId,
          cardsGroups,
        );
        if (isEqual) {
          const modifiedPlayers = table.players.map((player) => {
            if (player.userId === userId) {
              player.cardsGroups = cardsGroups;
            }
            return player;
          });

          table.players = modifiedPlayers;
          await this.tableService.updateReTable(table, pid);
        } else {
          throw new BadRequestException('Invalid CardsGroups for declaration');
        }

        const { isValid, player } = await this.checkDeclaredCards(
          tableId,
          userId,
          false,
        );

        const updatedPlayers = table.players.map((playerInfo) => {
          if (playerInfo.userId === userId) {
            playerInfo = player;
            playerInfo.isFirstDeclared = true;
          }
          return playerInfo;
        });

        table.players = updatedPlayers;
        table.declaredNo += 1;

        if (isValid) {
          table.declareCard = card;
          table.firstDeclaredPlayer = player.playerId;
          const timeout = dayjs()
            .add(config.reGameplay.finishDeclarationTimeout, 'second')
            .toISOString();
          table.gameStatus = ReGameStatus.declareCards;
          table.timeout = timeout;
          table.updatedAt = dayjs().toISOString();
          await this.tableService.updateReTable(table, pid);

          const players: any[] = [];
          await Promise.all(
            table.players.map((player) => {
              let status: Status = Status.active;
              if (player.late) {
                status = Status.waiting;
              } else if (player.softDrop) {
                status = Status.drop;
              }

              const { userId, ...playerInfoData } = player.playerInfo;

              if (player.userId === userId) {
                players.push({
                  playerId: player.playerId,
                  status,
                  declare: player.declare,
                  playerInfo: playerInfoData,
                  score: player.score,
                  cardGroups: player.cardsGroups,
                  winner: true,
                });
              } else {
                if (!player.late) {
                  players.push({
                    playerId: player.playerId,
                    status,
                    declare: player.declare,
                    playerInfo: playerInfoData,
                    score: player.score,
                    cardGroups: player.cardsGroups,
                    winner: false,
                  });
                }
              }
            }),
          );

          await Promise.all(
            table.leftPlayers.map((player) => {
              const amount = Big(player.score)
                .mul(Big(table.tableType.pointValue))
                .toFixed(2);

              const { userId, ...playerInfoData } = player.playerInfo;

              players.push({
                playerId: player.playerId,
                status: Status.leave,
                declare: player.declare,
                playerInfo: playerInfoData,
                score: Number(player.score),
                cardGroups: player.cardsGroups,
                winner: false,
                amount,
              });
            }),
          );

          await Promise.all(
            table.players.map(async (player_) => {
              const socketId = (await this.transientDBService.getUserSocketId(
                player_.userId,
              )) as SocketID;

              this.wss.to(socketId).emit('declareRes', {
                tableId,
                playerId: player.playerId,
                myPlayerId: player_.playerId,
                gameStatus: table.gameStatus,
                valid: isValid,
                card: card,
                timeout,
              });

              if (player_.playerId === player.playerId) {
                this.wss.to(socketId).emit('finishRes', {
                  tableId,
                  gameStatus: table.gameStatus,
                  players,
                  myPlayerId: player_.playerId,
                });
              }
            }),
          );

          await this.reQueueService.addTimeoutAction(
            tableId,
            GameAction.finishDeclaration,
            config.reGameplay.finishDeclarationTimeout,
          );
        } else {
          await Promise.all(
            table.players.map(async (player_) => {
              const socketId = (await this.transientDBService.getUserSocketId(
                player_.userId,
              )) as SocketID;

              this.wss.to(socketId).emit('declareRes', {
                tableId,
                playerId: player.playerId,
                myPlayerId: player_.playerId,
                gameStatus: table.gameStatus,
                valid: isValid,
                card: card,
              });
            }),
          );

          const activePlayers = this.tableService.getReActivePlayers(table);
          if (activePlayers.length === 1) {
            table.firstDeclaredPlayer = activePlayers[0].playerId;
            const timeout = dayjs()
              .add(config.reGameplay.startTimeout, 'second')
              .toISOString();
            table.timeout = timeout;
            await this.tableService.updateReTable(table, pid);
            await this.roundReEnd(tableId);
          } else {
            if (
              table.players.length === 1 &&
              table.players[0].userId === userId
            ) {
              table.firstDeclaredPlayer = table.players[0].playerId;
              const timeout = dayjs()
                .add(config.reGameplay.startTimeout, 'second')
                .toISOString();
              table.timeout = timeout;
              await this.tableService.updateReTable(table, pid);
              await this.roundReEnd(tableId);
            } else {
              const nextPlayer = this.tableService.getReNextActivePlayer(table);
              table.currentTurn = nextPlayer.playerId;
              table.updatedAt = dayjs().toISOString();
              await this.tableService.updateReTable(table, pid);
              await delay(500);
              await this.play(tableId);
            }
          }
        }
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      // leave logs
      console.log(
        `Error in Declaration Request. TableId: ${tableId} Card ${card} ${error}`,
      );
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  /**
   * Rummy Finish Declaration
   */
  @WsSubscribeMessage('finishReq')
  async onFinishDeclarationEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(FinishDeclarationRequest) { cardsGroups }: FinishDeclarationRequest,
  ) {
    const userId = client.user.userId;
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    let tableId: string = '';
    try {
      tableId = (await this.transientDBService.getUserActiveTableId(
        userId,
      )) as string;
      console.log(`Finish Declaration Request. TableId: ${tableId}`);
      if (tableId) {
        leaveLogs('Finish Declaration', { tableId });
        const { table, pid } =
          (await this.tableService.getReTableOrThrowException(
            tableId,
          )) as ReTableWithPid;
        leaveLogs('Finish Declaration lock', { tableId, pid });
        await this.redisService.releaseLock(tableId, pid);

        if (table.gameStatus !== ReGameStatus.declareCards) {
          throw new BadRequestException('Not the declare state');
        }

        const currentPlayer = table.players.find(
          (player) => player.userId === userId,
        );
        if (currentPlayer?.declare) {
          throw new BadRequestException('This user has already declared!');
        }
        if (currentPlayer && currentPlayer.late) {
          throw new BadRequestException('This player Cannot Declare Cards!');
        }

        await this.validateCardsGroup(tableId, userId, cardsGroups);

        const { isValid, player } = await this.checkDeclaredCards(
          tableId,
          userId,
          true,
        );

        console.log('CardsGroup Valid', isValid);

        const players: any[] = [];
        const updatedPlayers = table.players.map((playerInfo) => {
          if (playerInfo.userId === userId) {
            playerInfo = player;
            if (player.cardsGroups && table.wildCard) {
              const score = calculateScore(
                player.cardsGroups,
                table.wildCard,
                player.isDecValid,
              );

              console.log('Each Player Score', score);
              playerInfo.score = score.toString();
            }
          }

          return playerInfo;
        });
        table.players = updatedPlayers;
        table.declaredNo += 1;
        table.updatedAt = dayjs().toISOString();
        await this.tableService.updateReTable(table, pid);

        await Promise.all(
          table.players.map((playerInfo) => {
            let status: Status = Status.active;
            if (playerInfo.late) {
              status = Status.waiting;
            } else if (playerInfo.softDrop) {
              status = Status.drop;
            }

            const { userId, ...playerInfoData } = playerInfo.playerInfo;

            if (playerInfo.playerId === table.firstDeclaredPlayer) {
              players.push({
                playerId: playerInfo.playerId,
                status,
                declare: playerInfo.declare,
                playerInfo: playerInfoData,
                score: playerInfo.score,
                cardGroups: playerInfo.cardsGroups,
                winner: true,
              });
            } else {
              if (!playerInfo.late) {
                players.push({
                  playerId: playerInfo.playerId,
                  status,
                  declare: playerInfo.declare,
                  playerInfo: playerInfoData,
                  score: playerInfo.score,
                  cardGroups: playerInfo.cardsGroups,
                  winner: false,
                });
              }
            }
          }),
        );

        await Promise.all(
          table.leftPlayers.map((player) => {
            const amount = Big(player.score)
              .mul(Big(table.tableType.pointValue))
              .toFixed(2);

            const { userId, ...playerInfoData } = player.playerInfo;

            players.push({
              playerId: player.playerId,
              status: Status.leave,
              declare: player.declare,
              playerInfo: playerInfoData,
              score: Number(player.score),
              cardGroups: player.cardsGroups,
              winner: false,
              amount,
            });
          }),
        );

        await Promise.all(
          table.players.map(async (player_) => {
            if (
              (table.firstDeclaredPlayer &&
                player_.playerId === table.firstDeclaredPlayer) ||
              player_.userId === userId
            ) {
              const socketId = (await this.transientDBService.getUserSocketId(
                player_.userId,
              )) as SocketID;

              this.wss.to(socketId).emit('finishRes', {
                tableId,
                gameStatus: table.gameStatus,
                players,
                myPlayerId: player_.playerId,
              });
            }
          }),
        );

        if (table.declaredNo === table.joinNo) {
          await this.roundReEnd(tableId);
        }
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      // leave logs
      console.log(`Error in Finish Declaration Request. TableId: ${tableId}`);
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  async startReRound(tableId: string) {
    leaveLogs('startReRound create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('startReRound lock', { tableId, pid });
    try {
      if (
        table.gameStatus !== ReGameStatus.waiting &&
        table.gameStatus !== ReGameStatus.roundEnded
      ) {
        throw new BadRequestException(
          { gameStatus: table.gameStatus },
          'Game is already started',
        );
      }

      if (table.gameStatus === ReGameStatus.roundEnded) {
        const timeout = dayjs()
          .add(config.reGameplay.startTimeout, 'second')
          .toISOString();

        const updatedPlayers = await Promise.all(
          table.players.map((player) => {
            console.log('Updating player', player.active);
            player.active = true;
            player.drop = false;
            player.softDrop = false;
            player.declare = false;
            player.cards = [];
            player.cardsGroups = [];
            player.late = false;
            player.isDrawn = false;
            player.isDiscarded = false;
            player.isFirstDeclared = false;
            player.isDecValid = true;
            player.score = '0';
            player.turnNo = 0;

            return player;
          }),
        );
        table.players = updatedPlayers;
        console.log('UPDATED PLAYERS', table.players);

        const roundId = customAlphabet(config.reGameplay.alphaNumberics, 12)();
        table.roundId = roundId;

        const dealerId = this.tableService.getDealer(table);
        table.dealerId = dealerId;
        table.currentTurn = this.tableService.getDealer(table);
        table.closedDeckCards = [];
        table.openDeckCards = [];
        table.leftPlayers = [];
        table.droppedScore = '0';
        table.commissionAmount = '0';
        table.declaredNo = 0;
        table.joinNo = table.players.length;
        table.timeout = timeout;
        delete table.firstDeclaredPlayer;
        delete table.wildCard;
        delete table.declareCard;
        delete table.roundStartedAt;
        await this.tableService.updateReTable(table, pid);
      }

      const timeout = dayjs()
        .add(config.reGameplay.startTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      table.gameStatus = ReGameStatus.roundStarted;
      table.roundStartedAt = dayjs().toISOString();
      table.updatedAt = dayjs().toISOString();
      await this.tableService.updateReTable(table, pid);

      const playersData = table.players.map((player) => {
        const { playerId, score, declare, playerInfo, cardsGroups } = player;
        let status: Status = Status.active;
        if (player.late) {
          status = Status.waiting;
        } else if (player.softDrop) {
          status = Status.drop;
        }

        const { userId, ...playerInfoData } = playerInfo;

        return {
          playerId,
          score,
          status,
          declare,
          playerInfo: playerInfoData,
          cardGroups: cardsGroups,
        };
      });

      await Promise.all(
        table.players.map(async (player) => {
          const socketId = (await this.transientDBService.getUserSocketId(
            player.userId,
          )) as SocketID;

          this.wss.to(socketId).emit('roundStarted', {
            tableId,
            dealerId: table.dealerId,
            myPlayerId: player.playerId,
            currency: 'INR',
            currentTurn: table.currentTurn,
            gameStatus: table.gameStatus,
            timeout,
            serverTime: dayjs().toISOString(),
            isReconnected: false,
            roundId: table.roundId,
            wildCard: table.wildCard,
            drawCards: table.closedDeckCards,
            tableType: table.tableType,
            players: playersData,
          });
        }),
      );

      await this.reQueueService.addTimeoutAction(
        table.tableId,
        GameAction.dealCards,
        config.reGameplay.startTimeout,
      );
    } catch (error) {
      // leave logs
      console.log(`Error in startReRound TableId: ${tableId}`);
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('startReRound final unlock', { tableId, pid });
    }
  }

  /**
   * Dealing cards after initial betting of the table
   */
  async dealReCards(tableId: string) {
    leaveLogs('dealReCards create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('dealReCards lock', { tableId, pid });
    if (
      table.gameStatus === ReGameStatus.roundEnded ||
      table.gameStatus === ReGameStatus.gameEnded
    ) {
      leaveLogs('dealReCards game status', {
        gameStatus: table.gameStatus,
      });
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('dealReCards unlock', { tableId, pid });
      return;
    }
    try {
      const dealtTable = await this.tableService.dealReCards(table);
      const timeout = dayjs()
        .add(config.reGameplay.dealCardsTimeout, 'second')
        .toISOString();
      dealtTable.timeout = timeout;
      let noLatePlayers: number = 0;
      table.players.map((player) => {
        if (player.late) {
          noLatePlayers += 1;
        }
      });
      dealtTable.declaredNo = noLatePlayers;
      await this.tableService.updateReTable(dealtTable, pid);
      leaveLogs('deal ReCards unlock', { tableId, pid });

      await Promise.all(
        dealtTable.players.map(async (player) => {
          const socketId = (await this.transientDBService.getUserSocketId(
            player.userId,
          )) as SocketID;
          if (player.active) {
            const openDeckCards: string[] = [];
            const openDeckLength = table.openDeckCards.length;
            if (openDeckLength > 0) {
              openDeckCards.push(table.openDeckCards[openDeckLength - 1]);
            }

            this.wss.to(socketId).emit('dealCards', {
              tableId: dealtTable.tableId,
              gameStatus: dealtTable.gameStatus,
              cardsGroups: player.cardsGroups,
              wildCard: dealtTable.wildCard,
              openDeckCards: openDeckCards,
              timeout: timeout,
            });
          } else {
            this.wss.to(socketId).emit('dealCards', { timeout });
          }
        }),
      );

      await this.reQueueService.addTimeoutAction(
        table.tableId,
        GameAction.startPlaying,
        config.reGameplay.dealCardsTimeout,
      );
    } catch (error) {
      // leave logs
      console.log(`Error in dealCards TableId: ${tableId}`);
      throw error;
    } finally {
      console.log(`dealReCards final unlock TableId: ${tableId}`);
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  /**
   * Request to Leave Game Table
   */
  @WsSubscribeMessage('leaveTable')
  async onLeaveTableEvent(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    this.logger.log(`Leave Table Request. UserId ${userId}`);
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    let tableId: string = '';
    try {
      tableId = (await this.transientDBService.getUserActiveTableId(
        userId,
      )) as string;
      this.logger.log(`Leave Table Request. TableId ${tableId}`);
      if (tableId) {
        // await this.leaveTable(tableId, userId, true);
        leaveLogs('leave Table', { tableId });
        const { table, pid } =
          (await this.tableService.getReTableOrThrowException(
            tableId,
          )) as ReTableWithPid;
        leaveLogs('leave Table lock', { tableId, pid });
        await this.redisService.releaseLock(tableId, pid);

        await (table.gameStatus === ReGameStatus.waiting
          ? this.reGameplayController.leaveWaitingTable(userId)
          : this.dropPlayer(tableId, userId, false));

        // leave logs
        leaveLogs(`Gameplay log ${tableId} ${GameLog.leaveTable}`, {
          tableId,
          userId,
          action: GameLog.leaveTable,
          type: LogType.request,
        });
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      // leave logs
      console.log(`Error in Leave Table Request. TableId: ${tableId} ${error}`);
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('leaveWaitingTable')
  async onLeaveWaitingEvent(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    this.logger.log(`Leave Waiting Table Request. UserId ${userId}`);
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    try {
      console.debug('Leave Waiting Table', {
        userId,
      });
      // leave logs
      leaveLogs(`Gameplay log ${userId} ${GameLog.leaveWaitingTable}`, {
        userId,
        action: GameLog.leaveWaitingTable,
        type: LogType.request,
      });
      await this.reGameplayController.leaveWaitingTable(userId);
    } catch (error) {
      // leave logs
      console.log(
        `Error in Leave Waiting Table Request. UserId ${userId} ${error}`,
      );
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  /**
   * Request to Drop Game Table
   */
  @WsSubscribeMessage('dropReq')
  async onDropTableEvent(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    let tableId: string = '';
    try {
      tableId = (await this.transientDBService.getUserActiveTableId(
        userId,
      )) as string;
      console.log(`Drop Request. TableId: ${tableId}`);
      if (tableId) {
        // await this.leaveTable(tableId, userId, true);
        leaveLogs('leave Table', { tableId });
        const { table, pid } =
          (await this.tableService.getReTableOrThrowException(
            tableId,
          )) as ReTableWithPid;
        leaveLogs('leave Table lock', { tableId, pid });
        await this.redisService.releaseLock(tableId, pid);

        await this.dropPlayer(tableId, userId, true);
      } else {
        throw new NotFoundException({ userId }, 'Table not found for user');
      }
    } catch (error) {
      // leave logs
      console.log(`Error in Drop Request. TableId: ${tableId} ${error}`);
      throw error;
    } finally {
      await this.commonService.unlockUser(userId);
    }
  }

  /**
   * Check if the user had been already matched with other users
   */
  @WsSubscribeMessage('checkIfJoined')
  async onCheckIfJoined(@WsClient() client: ExtendedSocket) {
    const { user } = client;
    const userId = user.userId;

    // leave logs
    leaveLogs(`Gameplay log ${userId} ${GameLog.checkIfJoined}`, {
      userId,
      action: GameLog.checkIfJoined,
      type: LogType.request,
    });
    const status = await this.commonService.checkIfJoined(userId);
    await this.reGameplayController.leaveWaitingTable(userId, true);

    client.emit('checkIfJoinedRes', { status });

    // leave logs
    leaveLogs(`Gameplay log ${userId} ${GameLog.checkIfJoined}`, {
      userId,
      action: GameLog.checkIfJoined,
      type: LogType.response,
      payload: { status },
    });
  }

  async joinExistingReTable(table: ReTable, user: PlayerInfo) {
    const socketId = (await this.transientDBService.getUserSocketId(
      user.userId,
    )) as SocketID;
    this.wss.in(socketId).socketsJoin(table.tableId);

    const currentPlayer = table.players.find(
      (player) => player.userId === user.userId,
    ) as PlayerInfo;

    if (!currentPlayer.playerId) {
      throw new BadRequestException('Table is full');
    }

    const tableData = this.tableService.handleReTableResponse(
      table,
      user.userId,
    );

    const {
      tableId,
      dealerId,
      currentTurn,
      gameStatus,
      timeout,
      roundId,
      wildCard,
      openDeckCards,
      tableType,
      players,
    } = table;
    const playersData = players.map((player) => {
      let status: Status = Status.active;
      if (player.late) {
        status = Status.waiting;
      } else if (player.softDrop) {
        status = Status.drop;
      }
      if (player.userId === user.userId) {
        const {
          playerId,
          softDrop,
          drop,
          declare,
          playerInfo,
          score,
          cardsGroups,
        } = player;

        const { userId, ...playerInfoData } = playerInfo;

        return {
          playerId,
          status,
          declare,
          playerInfo: playerInfoData,
          score,
          cardGroups: cardsGroups,
        };
      } else {
        const { playerId, softDrop, declare, playerInfo, score } = player;

        const { userId, ...playerInfoData } = playerInfo;

        return {
          playerId,
          status,
          declare,
          playerInfo: playerInfoData,
          score,
        };
      }
    });

    this.wss.to(socketId).emit('joinTableRes', {
      table: {
        tableId,
        dealerId,
        myPlayerId: currentPlayer.playerId,
        currency: 'INR',
        currentTurn,
        gameStatus,
        timeout,
        serverTime: dayjs().toISOString(),
        roundId,
        wildCard,
        openDeckCards,
        tableType,
        players: playersData,
      },
      timeout: table.timeout,
      accepted: true,
    });

    const { playerId, declare, drop, softDrop, score, playerInfo } =
      currentPlayer;

    const { userId, ...playerInfoData } = playerInfo;

    let status: Status = Status.active;
    if (currentPlayer.late) {
      status = Status.waiting;
    } else if (currentPlayer.softDrop) {
      status = Status.drop;
    }

    this.wss
      .to(table.tableId)
      .except(socketId)
      .emit('playerJoined', {
        tableId,
        player: {
          playerId,
          userId,
          declare,
          status,
          score,
          playerInfo: playerInfoData,
        },
      });
  }

  async gameReEnded(tableId: string) {
    leaveLogs('gameReEnded create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('gameReEnded lock', { tableId, pid });
    if (table.gameStatus === ReGameStatus.gameEnded) {
      leaveLogs('The game is ended', { tableId });
      await this.redisService.releaseLock(tableId, pid);
      return;
    }
    try {
      const result = await this.commonService.getRoundResult(table);
      const leftIndexes: number[] = [];
      const players: any[] = [];
      await Promise.all(
        result.table.players.map((player) => {
          let status: Status = Status.active;
          if (player.late) {
            status = Status.waiting;
          } else if (player.softDrop) {
            status = Status.drop;
          }

          const { userId, ...playerInfoData } = player.playerInfo;

          if (player.playerId === table.firstDeclaredPlayer) {
            players.push({
              playerId: player.playerId,
              status,
              declare: player.declare,
              playerInfo: playerInfoData,
              score: Number(player.score),
              cardGroups: player.cardsGroups,
              winner: true,
              amount: result.winningAmount,
            });
          } else {
            if (!player.late) {
              const amount = Big(player.score)
                .mul(Big(table.tableType.pointValue))
                .toFixed(2);

              players.push({
                playerId: player.playerId,
                status,
                declare: player.declare,
                playerInfo: playerInfoData,
                score: Number(player.score),
                cardGroups: player.cardsGroups,
                winner: false,
                amount,
              });
            }
          }
        }),
      );
      await Promise.all(
        result.table.leftPlayers.map((player) => {
          const amount = Big(player.score)
            .mul(Big(table.tableType.pointValue))
            .toFixed(2);

          const { userId, ...playerInfoData } = player.playerInfo;

          players.push({
            playerId: player.playerId,
            status: Status.leave,
            declare: player.declare,
            playerInfo: playerInfoData,
            score: Number(player.score),
            cardGroups: player.cardsGroups,
            winner: false,
            amount,
          });
        }),
      );

      await Promise.all(
        result.table.players.map(async (player) => {
          const socketId = (await this.transientDBService.getUserSocketId(
            player.userId,
          )) as SocketID;

          this.wss.to(socketId).emit('roundEnded', {
            tableId,
            gameStatus: table.gameStatus,
            players,
            myPlayerId: player.playerId,
            timeout: result.table.timeout,
          });
        }),
      );

      const poorIndexes: number[] = [];
      await Promise.all(
        result.table.players.map(async (player, index) => {
          console.log('Each player Data', index);

          const POINT_MULTIPLIER = 80;
          const amount = Big(table.tableType.pointValue)
            .mul(Big(POINT_MULTIPLIER))
            .toString();

          const { walletBalance, subWallet } =
            await this.commonService.checkWalletBalance(player.userId, amount);

          console.log('Player Wallet Balance', walletBalance);
          if (Big(walletBalance.main).lt('0')) {
            await this.transientDBService.deleteReUserActiveTableId(
              player.userId,
            );
            const socketId = (await this.transientDBService.getUserSocketId(
              player.userId,
            )) as SocketID;

            this.wss.to(socketId).emit('leftTableRes', {
              accepted: true,
              tableId: table.tableId,
              playerId: player.playerId,
            });

            this.wss
              .to(table.tableId)
              .except(socketId)
              .emit('playerLeftTable', {
                accepted: true,
                tableId: table.tableId,
                playerId: player.playerId,
              });
            poorIndexes.push(index);
          }
        }),
      );

      console.log(`Poor Indexes: ${poorIndexes} TableId: ${tableId}`);
      // Remove Poor Players
      result.table.players = result.table.players.filter(
        (_, index) => !poorIndexes.includes(index),
      );
      console.log(`Remaining Players: ${table.players} TableId: ${tableId}`);

      // // check maintenance
      // const underMaintenance = this.remoteConfigService.getSpMaintenance();
      // if (underMaintenance && !table.isMaintenanceBypass) {
      //   leaveLogs('maintenance leave', { table });
      //   this.wss.to(tableId).emit('maintenance', { status: true });
      //   table.players.map((player) => {
      //     this.commonService.createLeftUserTableHistory(table, player.userId);
      //     this.commonService.createLeftUserRoundHistory(table, player.userId);
      //   });
      //   await this.redisService.releaseLock(tableId);
      //   await this.tableService.removeTable(table);
      //   await this.handleLeaveUser(table.tableType, table.players.length);
      //   leaveLogs(`Gameplay log ${tableId} ${GameLog.maintenance}`, {
      //     tableId: table.tableId,
      //     action: GameLog.maintenance,
      //     type: LogType.exception,
      //   });
      //   return;
      // }

      await this.tableService.updateReTable(result.table, pid);

      await (table.players.length >= 2
        ? this.reQueueService.addTimeoutAction(
            table.tableId,
            GameAction.startRound,
            config.reGameplay.startTimeout,
          )
        : this.endReGame(table.tableId));
    } catch (error) {
      // leave logs
      console.log(`Error in gameReEnded TableId: ${tableId} ${error}`);
      throw error;
    } finally {
      console.log(`gameReEnded final unlock TableId: ${tableId}`);
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async endReGame(tableId: string) {
    leaveLogs('endReGame create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('endReGame lock', { tableId, pid });
    const timeout = dayjs()
      .add(config.reGameplay.gameEndDelay, 'second')
      .toISOString();
    table.timeout = timeout;
    table.gameStatus = ReGameStatus.gameEnded;
    await this.tableService.updateReTable(table, pid);
    leaveLogs('endReGame unlock', { tableId: table.tableId, pid });
    await this.endReTable(tableId);
  }

  async endReTable(tableId: string) {
    leaveLogs('endReTable create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('endReTable lock', { tableId, pid });
    try {
      const activePlayers = await this.tableService.getReActivePlayers(table);
      if (activePlayers.length > 1) {
        leaveLogs('Unable to finish the table, more than 1 player exists', {
          tableId,
        });
        await this.redisService.releaseLock(tableId, pid);
        leaveLogs('endTable unlock', { tableId, pid });
        await this.startReRound(tableId);
        return;
      }

      this.wss.to(tableId).emit('gameEnd', {});

      await this.redisService.releaseLock(tableId);
      await this.commonService.createReTableHistory(table);
      await this.tableService.removeReTable(table);
      // for online user count

      await this.handleLeaveReUser(table.tableType, 1);
    } catch (error) {
      console.log(`Error in endReTable TableId: ${tableId} ${error}`);
      throw error;
    } finally {
      console.log(`endReTable final unlock TableId: ${tableId}`);
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async destroyInactiveTable(tableId: string) {
    // reward last amounts
    const table = (await this.tableService.getReTable(tableId)) as ReTable;
    if (!table) {
      throw new BadRequestException('Inactive Table to destroy does not exist');
    }
    const userIds = table.players.map((player) => player.userId);

    // TODO: refundInactiveTable
    // this.sqs.sendEvent({
    //   channel: Channel.spGameplay,
    //   op: 'refundInactiveTable',
    //   event: {
    //     userIds,
    //     amounts,
    //     currency: Currency.INR,
    //     tableId: table.tableId,
    //   },
    //   corId: nanoid(9),
    //   user: { _id: table.players[0].userId, roles: [Role.player] },
    // });
    this.handleLeaveReUser(table.tableType, table.players.length);
    table.players.map(async (player) => {
      const socketId = (await this.transientDBService.getUserSocketId(
        player.userId as UserID,
      )) as SocketID;
      this.wss
        .to(socketId)
        .emit('playerLeftTable', { playerId: player.playerId });
      this.commonService.createReLeftUserTableHistory(
        table,
        player.userId,
        true,
      );
    });
    await this.redisService.releaseLock(tableId);
    await this.tableService.removeReTable(table);

    // clear queue if it is locked
    const queueName = table.tableType.tableTypeId;
    await this.clearQueue(queueName);

    leaveLogs(`Gameplay log ${table.tableId} ${GameLog.destroyInactiveTable}`, {
      tableId: table.tableId,
      action: GameLog.destroyInactiveTable,
      type: LogType.exception,
    });
  }

  async drawCard(tableId: string, userId: string, card: ReCard) {
    leaveLogs('draw Card', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('drawCard lock', { tableId, pid, roundId: table.roundId });
    try {
      const playerId = table.players.find(
        (player) => player.userId === userId,
      )?.playerId;
      if (!playerId) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('userId not exist on table');
      }
      if (playerId !== table.currentTurn) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('Not your turn');
      }
      // if (table.gameStatus !== ReGameStatus.drawCard) {
      //   await this.redisService.releaseLock(tableId, pid);
      //   throw new BadRequestException('Not Draw Card State');
      // }

      const updatedPlayers = table.players.map((player) => {
        if (player.userId === userId) {
          player.cards?.push(card);
          player.isDrawn = true;
        }
        return player;
      });
      table.players = updatedPlayers;

      const openDeckLength = table.openDeckCards
        ? table.openDeckCards.length
        : 0;

      let drawFrom: string;

      if (
        table.openDeckCards &&
        card !== table.openDeckCards[openDeckLength - 1]
      ) {
        if (table.closedDeckCards && card === table.closedDeckCards[0]) {
          table.closedDeckCards.shift();
          drawFrom = 'CloseCardCell';
        } else {
          await this.redisService.releaseLock(tableId, pid);
          throw new BadRequestException('Invalid Card Request');
        }
      } else {
        if (table.openDeckCards) {
          table.openDeckCards.pop();
          drawFrom = 'OpenCardCell';
        }
      }

      const timeout = dayjs()
        .add(config.reGameplay.turnTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      table.updatedAt = dayjs().toISOString();
      table.gameStatus = ReGameStatus.discardCard;
      await this.tableService.updateReTable(table, pid);
      await Promise.all(
        table.players.map(async (player) => {
          const socketId = (await this.transientDBService.getUserSocketId(
            player.userId,
          )) as SocketID;

          this.wss.to(socketId).emit('drawRes', {
            tableId,
            playerId: table.currentTurn,
            myPlayerId: player.playerId,
            gameStatus: table.gameStatus,
            card,
            drawFrom,
            timeout: table.timeout,
          });
        }),
      );
    } catch (error) {
      // leave logs
      console.log(`Error in drawCard TableId: ${tableId} RoundId: ${table.roundId} error: ${error}`);
      throw error;
    } finally {
      leaveLogs('drawCard final unlock', { tableId, pid, roundId: table.roundId });
      this.redisService.releaseLock(tableId, pid);
    }
  }

  async discardCard(
    tableId: string,
    userId: string,
    card: string,
    isDeclare: boolean,
  ) {
    leaveLogs('discard Card', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('discard lock', { tableId, pid, roundId: table.roundId });
    try {
      const player = table.players.find((player) => player.userId === userId);
      if (!player?.playerId) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('userId not exist on table');
      }
      if (player.playerId !== table.currentTurn) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('Not your turn');
      }
      if (player.isDrawn !== true) {
        throw new BadRequestException('Draw Card first');
      }
      if (table.gameStatus !== ReGameStatus.discardCard) {
        throw new BadRequestException('Not the discard state');
      }

      const updatedPlayers = table.players.map((player) => {
        if (player.userId === userId) {
          if (player.cards?.length !== NumberOfCardsPerPlayer + 1) {
            throw new BadRequestException('Invalid Cards in Hand');
          }

          const indexOfCard = player.cards.indexOf(card);

          if (indexOfCard === -1) {
            leaveLogs('Card not found in the player cards', { card });
            throw new BadRequestException('Invalid Discard Request');
          }
          player.cards.splice(indexOfCard, 1);
          const updatedCardsGroups = player.cardsGroups?.map((group) => {
            const index = group.cards.indexOf(card);
            if (index !== -1) {
              group.cards.splice(index, 1);
            }
            return group;
          });

          player.cardsGroups = updatedCardsGroups;
          player.isDrawn = false;
          player.turnNo += 1;
        }
        return player;
      });

      if (!isDeclare) {
        await Promise.all(
          table.players.map(async (player) => {
            const socketId = (await this.transientDBService.getUserSocketId(
              player.userId,
            )) as SocketID;

            this.wss.to(socketId).emit('discardRes', {
              tableId,
              myPlayerId: player.playerId,
              playerId: table.currentTurn,
              card,
            });
          }),
        );
      }

      const nextPlayer = this.tableService.getReNextActivePlayer(table);
      table.currentTurn = nextPlayer.playerId;

      const timeout = dayjs()
        .add(config.reGameplay.dealCardsTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      table.players = updatedPlayers;
      table.turnNo += 1;
      table.openDeckCards.push(card);

      // reset closeDeckCards when it's empty
      let isReshuffled: boolean = false;
      if (
        table.closedDeckCards.length === 0 &&
        table.openDeckCards.length > 0
      ) {
        const openDeckCards = table.openDeckCards;
        table.openDeckCards = [];
        const openCard = openDeckCards.shift();
        if (openCard) {
          table.openDeckCards.push(openCard);
        }
        table.closedDeckCards = openDeckCards;

        isReshuffled = true;
      }

      table.updatedAt = dayjs().toISOString();
      await this.tableService.updateReTable(table, pid);
      if (!isDeclare) {
        await this.reQueueService.addTimeoutAction(
          table.tableId,
          GameAction.next,
          config.reGameplay.nextTimeout,
          {
            isReshuffled,
          },
        );
      }
    } catch (error) {
      console.log(`Error in discard TableId: ${tableId} RoundId: ${table.roundId} error: ${error}`);
      throw error;
    } finally {
      leaveLogs('discardCard final unlock', { tableId, pid, roundId: table.roundId });
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async dropPlayer(tableId: string, userId: string, isDrop: boolean) {
    leaveLogs('drop Player', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('drop Player Lock', { tableId, pid, roundId: table.roundId });

    if (
      (table.gameStatus === ReGameStatus.roundEnded ||
        table.gameStatus === ReGameStatus.declareCards) &&
      isDrop
    ) {
      leaveLogs('drop Player unlock', { tableId, pid });
      await this.redisService.releaseLock(tableId, pid);
      throw new BadRequestException('Cannot drop table');
    }

    try {
      const currentPlayer = table.players.find(
        (player) => player.userId === userId,
      );
      if (!currentPlayer) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('userId not exist on table');
      }
      if (currentPlayer.late && isDrop) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('Cannot drop table, just leave');
      }

      const turn: number = currentPlayer.turnNo;

      if (table.gameStatus === ReGameStatus.roundEnded) {
        if (table.players.length < 2) {
          await this.redisService.releaseLock(tableId, pid);
          throw new BadRequestException('Cannot leave table');
        }

        let leftIndex = 0;
        await Promise.all(
          table.players.map(async (player, index) => {
            const socketId = (await this.transientDBService.getUserSocketId(
              player.userId,
            )) as SocketID;

            if (player.userId === currentPlayer.userId && !isDrop) {
              await this.transientDBService.deleteReUserActiveTableId(
                currentPlayer.userId,
              );
              leftIndex = index;
              this.wss.to(socketId).emit('leftTableRes', {
                accepted: true,
                tableId,
                playerId: player.playerId,
              });
            } else {
              this.wss.to(socketId).emit('playerLeftTable', {
                accepted: true,
                tableId,
                playerId: currentPlayer.playerId,
              });
            }
          }),
        );

        table.players.splice(leftIndex, 1);
        table.updatedAt = dayjs().toISOString();
        await this.tableService.updateReTable(table, pid);
        if (table.players.length === 1) {
          await this.endReGame(tableId);
        }
      } else {
        const remainedPlayers =
          await this.tableService.getReRemainingPlayers(table);
        if (
          remainedPlayers.length < 2 ||
          table.gameStatus === ReGameStatus.gameEnded
        ) {
          leaveLogs('drop Player unlock', { tableId, pid });
          await this.redisService.releaseLock(tableId, pid);
          throw new BadRequestException('Cannot leave table');
        }

        let leftUserScore: string = '';
        let leftIndex: number = 0;
        const updatedPlayers = await Promise.all(
          table.players.map(async (player, index) => {
            if (player.userId === currentPlayer.userId) {
              player.active = false;
              player.softDrop = true;
              leftIndex = index;

              if (!player.late) {
                if (player.declare) {
                  leftUserScore = player.score;
                } else {
                  if (turn >= 1) {
                    player.score = '40';
                    leftUserScore = '40';
                  } else {
                    player.score = '20';
                    leftUserScore = '20';
                  }
                }
              }

              if (!isDrop) {
                player.drop = true;
                await this.transientDBService.deleteReUserActiveTableId(
                  currentPlayer.userId,
                );
                if (!player.late) {
                  table.leftPlayers.push(player);
                }
              }
            }
            return player;
          }),
        );

        table.players = updatedPlayers;

        if (currentPlayer.late) {
          table.joinNo -= 1;
          table.declaredNo -= 1;
        } else {
          if (!currentPlayer.declare) {
            table.declaredNo += 1;
          }
        }

        table.players.map(async (player) => {
          const socketId = (await this.transientDBService.getUserSocketId(
            player.userId,
          )) as SocketID;

          if (player.userId === userId) {
            if (isDrop) {
              this.wss.to(socketId).emit('dropRes', {
                tableId,
                playerId: player.playerId,
                myPlayerId: player.playerId,
              });
            } else {
              this.wss.to(socketId).emit('dropRes', {
                tableId,
                playerId: player.playerId,
                myPlayerId: player.playerId,
              });
              this.wss.to(socketId).emit('leftTableRes', {
                accepted: true,
                tableId,
                playerId: player.playerId,
              });

              this.wss.in(socketId).socketsLeave(table.tableId);
            }
          } else {
            if (isDrop) {
              this.wss.to(socketId).emit('dropRes', {
                tableId,
                playerId: currentPlayer.playerId,
                myPlayerId: player.playerId,
              });
            } else {
              this.wss.to(socketId).emit('playerLeftTable', {
                accepted: true,
                tableId,
                playerId: currentPlayer.playerId,
              });
            }
          }
        });

        // Deduct money from left player & create Table history for left users
        if (!isDrop) {
          if (leftUserScore) {
            await this.commonService.debitReTable(
              [currentPlayer.userId],
              [getAmount(leftUserScore, table.tableType.pointValue)],
              table.tableId,
            );

            table.droppedScore = Big(leftUserScore)
              .add(Big(table.droppedScore))
              .toString();
          }
          if (!currentPlayer.late) {
            await this.commonService.createReLeftUserTableHistory(
              table,
              userId,
            );
          }

          console.log('dropped Score', table.droppedScore);
          table.players.splice(leftIndex, 1);
          console.log('Players after leave', table.players);
        }
        await this.tableService.updateReTable(table, pid);

        const activePlayers = this.tableService.getReActivePlayers(table);
        if (activePlayers.length === 1 && !table.firstDeclaredPlayer) {
          table.firstDeclaredPlayer = activePlayers[0].playerId;
          table.updatedAt = dayjs().toISOString();
          await this.tableService.updateReTable(table, pid);
          await this.roundReEnd(tableId);
        } else {
          if (
            (table.players.length === 1 || activePlayers.length === 0) &&
            table.gameStatus === ReGameStatus.declareCards
          ) {
            await this.roundReEnd(tableId);
          } else {
            if (currentPlayer.playerId === table.currentTurn) {
              const nextPlayer = this.tableService.getReNextActivePlayer(table);
              table.currentTurn = nextPlayer.playerId;
              console.log(
                `Current turn Player: ${table.currentTurn} TableId: ${tableId}`,
              );
              table.turnNo += 1;
              await this.tableService.updateReTable(table, pid);
              console.log(`Switch Turn TableId: ${tableId}`);
              if (table.gameStatus !== ReGameStatus.dealCards) {
                await this.play(tableId);
              }
            }
          }
        }
      }
    } catch (error) {
      // leave logs
      console.log(`Error in drop TableId: ${tableId} RoundId: ${table.roundId} error: ${error}`);
      throw error;
    } finally {
      leaveLogs('drop player final unlock', { tableId, pid, roundId: table.roundId });
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async validateCardsGroup(
    tableId: string,
    userId: string,
    cardsGroup: ReCardsGroup[],
  ): Promise<boolean> {
    leaveLogs('User define Cards Group', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('User define Cards Group lock', { tableId, pid, roundId: table.roundId });

    const socketId = (await this.transientDBService.getUserSocketId(
      userId,
    )) as SocketID;

    try {
      const player = table.players.find((player) => player.userId === userId);

      if (!player?.playerId) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('userId not exist on table');
      }

      const userCards: string[] = [];
      for (const group of cardsGroup) {
        for (const card of group.cards) {
          userCards.push(card);
        }
      }

      if (player.cards?.length !== userCards.length) {
        throw new BadRequestException(
          'Cards Mismatching between clients and server',
        );
      }

      const sortedCurrentCards = [...player.cards].sort();
      const sortedClientCards = [...userCards].sort();

      if (
        JSON.stringify(sortedCurrentCards) === JSON.stringify(sortedClientCards)
      ) {
        player.cardsGroups = cardsGroup;
        table.updatedAt = dayjs().toISOString();
        this.tableService.updateReTable(table, pid);
      } else {
        throw new BadRequestException(
          'Cards Mismatching between clients and server',
        );
      }
      return true;
    } catch (error) {
      // leave logs
      console.log(`Error in validateCardsGroup TableId: ${tableId} RoundId: ${table.roundId} error: ${error}`);
      throw error;
    } finally {
      leaveLogs('User define Cards Group unlock', { tableId, pid, roundId: table.roundId });
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async checkDeclaredCards(
    tableId: string,
    userId: string,
    isFinishRequest: boolean,
  ): Promise<ReDeclarationResult> {
    leaveLogs('Declaration', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('Declaration lock', { tableId, pid, roundId: table.roundId });

    const socketId = (await this.transientDBService.getUserSocketId(
      userId,
    )) as SocketID;

    try {
      const player = table.players.find((player) => player.userId === userId);
      if (!table.wildCard) {
        throw new BadRequestException('Wild Card not exist');
      }
      const { wildCard } = table;
      if (!wildCard) {
        throw new NotFoundException('Wild Card not exist in Table');
      }
      const wildCardInfo = getCardInfo(wildCard);

      if (!player?.playerId) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('userId not exist on table');
      }

      const lengthOfGroups = player.cardsGroups?.length;
      let isValid = true;
      let isPureSeqValid = false;
      let isImpureSeqValid = false;
      let isOthersValid = false;
      let noPureSequence = 0;
      let noImPureSequence = 0;

      const updatedGroups: ReCardsGroup[] = [];
      for (const group of player.cardsGroups || []) {
        if (group.cards.length >= 3) {
          isPureSeqValid = await this.checkPureSequence(group.cards);
          if (isPureSeqValid) {
            group.groupState = ReGroupState.pureSequence;
            group.valid = true;
          } else {
            isImpureSeqValid = await this.checkImpureSequence(
              group.cards,
              wildCardInfo,
            );
            if (isImpureSeqValid) {
              group.groupState = ReGroupState.impureSequence;
              group.valid = true;
            } else {
              isOthersValid = await this.checkSet(group.cards, wildCardInfo);
              if (isOthersValid) {
                group.groupState = ReGroupState.set;
                group.valid = true;
              } else {
                group.valid = false;
                isValid = false;
              }
            }
          }
        } else {
          group.valid = false;
          isValid = false;
        }
        updatedGroups.push(group);
      }

      player.cardsGroups = updatedGroups;
      player.declare = true;
      player.active = false;
      if (!isValid && !isFinishRequest) {
        player.score = '80';
        player.softDrop = true;
      }

      player.cardsGroups?.map((group) => {
        if (group.groupState === ReGroupState.pureSequence) {
          noPureSequence++;
        }
        if (group.groupState === ReGroupState.impureSequence) {
          noImPureSequence++;
        }
      });

      if (noPureSequence === 0 || noPureSequence + noImPureSequence < 2) {
        // TODO: Invalid Declaration Handling
        isValid = false;
        player.isDecValid = false;
        if (!isFinishRequest) {
          player.score = '80';
          player.softDrop = true;
        }

        return {
          isValid,
          player,
        };
      }

      return {
        isValid,
        player,
      };
    } catch (error) {
      // leave logs
      console.log(`Error in checkDeclarations TableId: ${tableId} RoundId: ${table.roundId} error: ${error}`);
      throw error;
    } finally {
      leaveLogs('Declaration unlock', { tableId, pid, roundId: table.roundId });
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async checkPureSequence(cardsArray: string[]): Promise<boolean> {
    // extract suit and number
    const cards: string[] = [];
    cardsArray.map((card) => {
      const cardInfo = getCardInfo(card);
      cards.push(cardInfo);
    });

    cards.sort(sortCardsByNumber);
    console.log('Pure sequence Cards', cards);
    // Check if pure sequence is valid
    const isValidRight = false;
    const isValidLeft = false;
    let numberOfNeededCards = 0;
    const suit = cards[0].split(',')[0];
    for (let index = cards.length - 1; index > 0; index--) {
      const previousCardNumber: string = cards[index - 1].split(',')[1];
      const currentCardNumber: string = cards[index].split(',')[1];
      const currentCardSuit: string = cards[index].split(',')[0];
      if (currentCardSuit === suit) {
        if (Number(currentCardNumber) - Number(previousCardNumber) === 1) {
          numberOfNeededCards +=
            Number(currentCardNumber) - Number(previousCardNumber) - 1;
        } else {
          if (index === cards.length - 1 && currentCardNumber === '14') {
            const subValues = cards[index].split(',');
            if (subValues.length === 2 && subValues[1] === '14') {
              subValues[1] = '1';
            }
            const updatedCard = subValues.join(',');
            cards.splice(index, 1);
            cards.unshift(updatedCard);

            for (let index_ = cards.length - 1; index_ > 0; index_--) {
              const previousCardNumber_: string =
                cards[index_ - 1].split(',')[1];
              const currentCardNumber_: string = cards[index_].split(',')[1];
              const currentCardSuit_: string = cards[index_].split(',')[0];
              if (
                currentCardSuit_ === suit &&
                Number(currentCardNumber_) - Number(previousCardNumber_) === 1
              ) {
                numberOfNeededCards +=
                  Number(currentCardNumber_) - Number(previousCardNumber_) - 1;
              } else {
                return false;
              }
            }

            console.log(
              'Pure Number of Needed Cards Inverse',
              numberOfNeededCards,
            );
            return numberOfNeededCards === 0 ? true : false;
          } else {
            return false;
          }
        }
      } else {
        return false;
      }
    }

    return true;
  }

  async checkImpureSequence(
    cardsArray: string[],
    wildCard: string,
  ): Promise<boolean> {
    // extract suit and number
    let cards: string[] = [];
    cardsArray.map((card) => {
      const cardInfo = getCardInfo(card);
      cards.push(cardInfo);
    });
    if (cards.length === 0) {
      throw new BadRequestException('Bad Cards Request');
    }

    const cdRedJoker: string = ReCard.cdRedJoker;
    const cdBlackJoker: string = ReCard.cdBlackJoker;

    const idsOfJokerWild: number[] = [];
    for (const [index, card] of cards.entries()) {
      if (card === cdRedJoker || card === cdBlackJoker) {
        idsOfJokerWild.push(index);
      }
      const currentNumber: string = card.split(',')[1];
      const wildNumber: string = wildCard.split(',')[1];
      if (currentNumber === wildNumber) {
        idsOfJokerWild.push(index);
      }
    }

    console.log('Impure Sequence Joker Wild', idsOfJokerWild);

    cards = cards.filter((_, index) => !idsOfJokerWild.includes(index));

    if (cards.length <= 1) {
      return true;
    }

    cards.sort(sortCardsByNumber);
    console.log('Impure sequence Cards', cards);

    let numberOfNeededCards = 0;
    const suit = cards[0][0];
    for (let index = cards.length - 1; index > 0; index--) {
      const currentCardNumber: string = cards[index].split(',')[1];
      const previousCardNumber: string = cards[index - 1].split(',')[1];
      if (
        cards[index][0] === suit &&
        Number(currentCardNumber) - Number(previousCardNumber) >= 1
      ) {
        numberOfNeededCards +=
          Number(currentCardNumber) - Number(previousCardNumber) - 1;
      } else {
        return false;
      }
    }

    console.log('Impure Number of Needed Cards', numberOfNeededCards);
    if (
      numberOfNeededCards >= 0 &&
      numberOfNeededCards <= idsOfJokerWild.length
    ) {
      return true;
    } else {
      const indexOfLastCard = cards.length - 1;
      const lastCardNumber: string = cards[indexOfLastCard].split(',')[1];
      if (lastCardNumber === '14') {
        const subValues = cards[indexOfLastCard].split(',');
        if (subValues.length === 2 && subValues[1] === '14') {
          subValues[1] = '1';
        }
        const updatedCard = subValues.join(',');
        cards.splice(indexOfLastCard, 1);
        cards.unshift(updatedCard);

        numberOfNeededCards = 0;
        for (let index = cards.length - 1; index > 0; index--) {
          const currentCardNumber_ = cards[index].split(',')[1];
          const previousCardNumber_ = cards[index - 1].split(',')[1];
          if (
            cards[index][0] === suit &&
            Number(currentCardNumber_) - Number(previousCardNumber_) >= 1
          ) {
            numberOfNeededCards +=
              Number(currentCardNumber_) - Number(previousCardNumber_) - 1;
          } else {
            return false;
          }
        }

        console.log('Impure Number of Needed Cards', numberOfNeededCards);
        return numberOfNeededCards <= idsOfJokerWild.length &&
          numberOfNeededCards >= 0
          ? true
          : false;
      } else {
        return false;
      }
    }
  }

  async checkSet(cardsArray: string[], wildCard: string): Promise<boolean> {
    const suits = ['H', 'S', 'D', 'C'];
    const cdRedJoker: string = ReCard.cdRedJoker;
    const cdBlackJoker: string = ReCard.cdBlackJoker;

    let cards: string[] = [];
    cardsArray.map((card) => {
      const cardInfo = getCardInfo(card);
      cards.push(cardInfo);
    });
    if (cards.length === 0) {
      throw new BadRequestException('Bad Cards Request');
    }

    const idsOfJokerWild: number[] = [];
    for (const [index, card] of cards.entries()) {
      if (card === cdRedJoker || card === cdBlackJoker) {
        idsOfJokerWild.push(index);
      }
      const cardNumber = card.split(',')[1];
      const wildCardNumber = wildCard.split(',')[1];
      if (cardNumber === wildCardNumber) {
        idsOfJokerWild.push(index);
      }
    }

    console.log('Set Joker Wild Cards', idsOfJokerWild);
    cards = cards.filter((_, index) => !idsOfJokerWild.includes(index));
    if (cards.length <= 1) {
      return true;
    }

    const setNumber: string = cards[0].split(',')[1];
    for (const card of cards) {
      const currentNumber: string = card.split(',')[1];
      if (currentNumber !== setNumber) {
        return false;
      }

      const suitIndex = suits.indexOf(card[0]);
      if (suitIndex === -1) {
        return false;
      } else {
        suits.splice(suitIndex, 1);
      }
    }

    return true;
  }

  async play(tableId: string, isReshuffled?: boolean) {
    // decide if there is winner
    leaveLogs('play create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('play lock', { tableId, pid, roundId: table.roundId });
    try {
      if (
        table.gameStatus === ReGameStatus.dealCards ||
        table.gameStatus === ReGameStatus.drawCard ||
        table.gameStatus === ReGameStatus.discardCard
      ) {
        table.gameStatus = ReGameStatus.drawCard;
        table.updatedAt = dayjs().toISOString();

        const timeout = dayjs()
          .add(config.reGameplay.turnTimeout, 'second')
          .toISOString();
        table.timeout = timeout;
        await this.tableService.updateReTable(table, pid);

        let dropPoints: number = 0;
        table.players.map((player) => {
          if (player.playerId === table.currentTurn) {
            dropPoints = player.turnNo > 0 ? 40 : 20;
          }
        });

        const closeDeckLength = table.closedDeckCards.length;
        let closeDeckCard = '';
        if (closeDeckLength > 0) {
          closeDeckCard = table.closedDeckCards[0];
        }

        let openDeckCard = '';
        const openDeckLength = table.openDeckCards.length;
        if (openDeckLength > 0) {
          openDeckCard = table.openDeckCards[openDeckLength - 1];
        }

        await Promise.all(
          table.players.map(async (player) => {
            const socketId = (await this.transientDBService.getUserSocketId(
              player.userId,
            )) as SocketID;

            this.wss.to(socketId).emit('playerTurnRes', {
              tableId,
              gameStatus: table.gameStatus,
              playerId: table.currentTurn,
              myPlayerId: player.playerId,
              openDeckCard,
              closeDeckCard,
              dropPoints,
              serverTime: dayjs().toISOString(),
              timeout,
            });
          }),
        );

        if (isReshuffled) {
          this.wss.to(tableId).emit('reshuffleCloseDeck', {
            tableId,
            openDeckCard,
          });
        }

        console.log('Player Turn Res Close Deck Cards', table.closedDeckCards);

        await this.reQueueService.addTimeoutAction(
          tableId,
          GameAction.dropPlayer,
          config.reGameplay.turnTimeout,
          {
            turnNo: table.turnNo,
            currentTurn: table.currentTurn,
            roundId: table.roundId,
          },
        );
      }
    } catch (error) {
      // leave logs
      console.log(`Error in play TableId: ${tableId} RoundId: ${table.roundId} error: ${error}`);
      throw error;
    } finally {
      console.log(`play final unlock TableId: ${tableId} ${pid} RoundId: ${table.roundId}`);
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async roundReEnd(tableId: string) {
    leaveLogs('roundReEnd create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    try {
      leaveLogs('roundReEnd lock', { tableId, pid, roundId: table.roundId });
      await this.commonService.createReRoundHistory(table);
      if (table.gameStatus === ReGameStatus.gameEnded) {
        await this.redisService.releaseLock(tableId, pid);
        leaveLogs('roundReEnd unlock', { tableId: table.tableId, pid });
        return;
      }
      table.gameStatus = ReGameStatus.roundEnded;
      const timeout = dayjs()
        .add(config.reGameplay.startTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      await this.tableService.updateReTable(table, pid);
      await this.gameReEnded(tableId);
    } catch (error) {
      console.log(`Error in roundReEnd TableId: ${tableId} RoundId: ${table.roundId} error: ${error}`);
      throw error;
    } finally {
      console.log(`roundReEnd final unlock TableId: ${tableId} RoundId: ${table.roundId}`);
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async finishRound(tableId: string) {
    leaveLogs('finishRound create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('finishRound lock', { tableId, pid, roundId: table.roundId });
    try {
      if (
        table.gameStatus === ReGameStatus.declareCards &&
        table.declaredNo !== table.joinNo
      ) {
        const { wildCard } = table;
        if (!wildCard) {
          throw new NotFoundException('Wild Card not exist in Table');
        }
        const wildCardInfo = getCardInfo(wildCard);

        const updatedPlayers = await Promise.all(
          table.players.map(async (player) => {
            if (!player.declare) {
              const updatedGroups: ReCardsGroup[] = [];
              let isPureSeqValid = false;
              let isImpureSeqValid = false;
              let isOthersValid = false;
              let noPureSequence = 0;
              let noImPureSequence = 0;
              for (const group of player.cardsGroups || []) {
                if (group.cards.length >= 3) {
                  isPureSeqValid = await this.checkPureSequence(group.cards);

                  if (isPureSeqValid) {
                    group.groupState = ReGroupState.pureSequence;
                    group.valid = true;
                  } else {
                    isImpureSeqValid = await this.checkImpureSequence(
                      group.cards,
                      wildCardInfo,
                    );

                    if (isImpureSeqValid) {
                      group.groupState = ReGroupState.impureSequence;
                      group.valid = true;
                    } else {
                      isOthersValid = await this.checkSet(
                        group.cards,
                        wildCardInfo,
                      );

                      if (isOthersValid) {
                        group.groupState = ReGroupState.set;
                        group.valid = true;
                      } else {
                        group.valid = false;
                      }
                    }
                  }
                } else {
                  group.valid = false;
                }

                updatedGroups.push(group);
              }

              player.cardsGroups = updatedGroups;

              player.cardsGroups?.map((group) => {
                if (group.groupState === ReGroupState.pureSequence) {
                  noPureSequence++;
                }
                if (group.groupState === ReGroupState.impureSequence) {
                  noImPureSequence++;
                }
              });

              if (
                noPureSequence === 0 ||
                noPureSequence + noImPureSequence < 2
              ) {
                // TODO: Invalid Declaration Handling
                player.isDecValid = false;
              }
            }

            return player;
          }),
        );

        table.players = updatedPlayers;

        await this.tableService.updateReTable(table, pid);

        await this.roundReEnd(tableId);
      }
    } catch (error) {
      console.log(`Error in finishRound TableId: ${tableId} RoundId: ${table.roundId} error: ${error}`);
      throw error;
    } finally {
      console.log(`finishRound final unlock TableId: ${tableId} RoundId: ${table.roundId}`);
      await this.redisService.releaseLock(tableId, pid);
    }
  }

  async joinTable(userIds: UserID[], tableId: TableID) {
    leaveLogs('joinTable create', { tableId });
    const { table, pid } = (await this.tableService.getReTableOrThrowException(
      tableId,
    )) as ReTableWithPid;
    leaveLogs('joinTable lock', { tableId, pid, roundId: table.roundId });
    await this.redisService.releaseLock(tableId, pid);

    await Promise.all([
      userIds.map(async (userId) => {
        const socketId = (await this.transientDBService.getUserSocketId(
          userId,
        )) as SocketID;
        this.wss.in(socketId).socketsJoin(tableId);
      }),
    ]);

    const {
      dealerId,
      currentTurn,
      gameStatus,
      timeout,
      roundId,
      wildCard,
      openDeckCards,
      tableType,
      players,
    } = table;

    await Promise.all(
      table.players.map(async (player) => {
        const socketId = (await this.transientDBService.getUserSocketId(
          player.userId,
        )) as SocketID;

        const playersData = players.map((player_) => {
          const { playerId, declare, playerInfo, score, cardsGroups } = player_;

          let status: Status = Status.active;
          if (player_.late) {
            status = Status.waiting;
          } else if (player_.softDrop) {
            status = Status.drop;
          }

          const { userId, ...playerInfoData } = playerInfo;

          return player_.userId === player.userId
            ? {
                playerId,
                status,
                declare,
                playerInfo: playerInfoData,
                score,
                cardGroups: cardsGroups,
              }
            : {
                playerId,
                status,
                declare,
                playerInfo: playerInfoData,
                score,
              };
        });

        this.wss.to(socketId).emit('joinTableRes', {
          table: {
            tableId,
            dealerId,
            myPlayerId: player.playerId,
            currency: 'INR',
            currentTurn,
            gameStatus,
            timeout,
            serverTime: dayjs().toISOString(),
            roundId,
            wildCard,
            openDeckCards,
            tableType,
            players: playersData,
          },
          timeout: table.timeout,
          accepted: true,
        });
        table.players.map(async (player_) => {
          if (player_.userId !== player.userId) {
            const socketId_ = (await this.transientDBService.getUserSocketId(
              player.userId,
            )) as SocketID;

            const { playerId, declare, active, softDrop, score, playerInfo } =
              player_;

            const { userId, ...playerInfoData } = playerInfo;

            let status: Status = Status.active;
            if (player_.late) {
              status = Status.waiting;
            } else if (player_.softDrop) {
              status = Status.drop;
            }

            this.wss.to(socketId_).emit('playerJoined', {
              tableId,
              player: {
                playerId,
                userId,
                status,
                declare,
                score,
                playerInfo: playerInfoData,
              },
            });
          }
        });
      }),
    );
  }

  async leftWaitingTable(userId: UserID, status: boolean) {
    leaveLogs('leave waiting table', { userId });
    const socketId = (await this.transientDBService.getUserSocketId(
      userId,
    )) as SocketID;
    // await this.transientDBService.deleteUserActiveTableId(userId);
    this.wss.to(socketId).emit('leaveWaitingTableRes', {
      accepted: status,
    });

    // leave logs
    leaveLogs(`Gameplay log ${userId} ${GameLog.leaveWaitingTableResponse}`, {
      userId,
      action: GameLog.leaveWaitingTableResponse,
      type: LogType.response,
      payload: {
        status,
      },
    });
  }

  async handleExpiredUsers(userId: UserID) {
    console.log('handleExpiredUsers invoked!');
    leaveLogs('leave waiting table', { userId });
    const socketId = (await this.transientDBService.getUserSocketId(
      userId,
    )) as SocketID;
    // await this.transientDBService.deleteUserActiveTableId(userId);
    this.wss.to(socketId).emit('matchingTimeout', {});
  }

  async clearQueue(queueName: string) {
    if (await this.transientDBService.getQueueLock(queueName)) {
      await this.transientDBService.setQueueLock(queueName, false);
      const userIds = await this.redisService.getKeys(queueName);
      await Promise.all(
        userIds.map(async (userId) => {
          await this.reGameplayController.leaveWaitingTable(userId);
        }),
      );
    }
  }

  async broadcastOnlineUserCount() {
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
    @WsClient() client: ExtendedSocket,
    @WsData(EmojiData) emojiData: EmojiData,
  ) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    if (!tableId) {
      throw new BadRequestException('TableId not found for the user');
    }
    this.wss.to(tableId).emit('deliverEmoji', { tableId, ...emojiData });
  }

  /**
   * Send message to opponent players
   */
  @WsSubscribeMessage('sendMessage')
  async onSendMessagEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(MessageData) messageData: MessageData,
  ) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    if (!tableId) {
      throw new BadRequestException('TableId not found for the user');
    }
    this.wss.to(tableId).emit('deliverMessage', { tableId, ...messageData });
  }

  /**
   * Get Socket from ID
   * @param {Socket} client - socket object
   * @returns {string} tableID
   */
  async getSocket(socketId: SocketID): Promise<ExtendedSocket | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sockets = (await this.wss
      .in(socketId)
      .fetchSockets()) as ExtendedSocket[];
    return sockets[0];
  }

  /**
   * Get Online User Count
   */
  // @UseGuards(UserGuard)
  @UseGuards(WsMaintenanceGuard)
  @WsSubscribeMessage('getUserCount')
  async getUserCount(@WsClient() client: ExtendedSocket) {
    const tables = this.remoteConfigService.getReTableInfos();
    const tablesTypes: any = [];
    for (const table of tables) {
      const userNo: string = (await this.transientDBService.getUserCount(
        table.tableTypeId,
      )) as string;
      tablesTypes.push({ ...table, userCount: userNo });
    }
    client.emit('allUserCount', { tables: tablesTypes });
  }

  async handleReJoinUser(tableType: ReTableType, number_: number) {
    const userCount = await this.transientDBService.incrementUserCount(
      tableType.tableTypeId,
      number_,
    );
    this.wss.emit('userCount', {
      ...tableType,
      userCount,
    });
  }

  /**
   * This is for counting online users in Leave Case
   */
  async handleLeaveReUser(tableType: ReTableType, number_: number) {
    const userCount = await this.transientDBService.incrementUserCount(
      tableType.tableTypeId,
      -number_,
    );
    if (userCount > 0) {
      this.wss.emit('userCount', {
        ...tableType,
        userCount,
      });
    } else {
      this.transientDBService.setUserCount(tableType.tableTypeId, 0);
      this.wss.emit('userCount', {
        ...tableType,
        userCount: 0,
      });
    }
  }
}
