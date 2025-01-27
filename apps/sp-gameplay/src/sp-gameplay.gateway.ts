/* eslint-disable @typescript-eslint/no-unused-vars */
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
  Card,
  GameAction,
  GameLog,
  GameStatus,
  LogType,
  PlayerGameInfo,
  PlayerId,
  SubWallet,
  Table,
  TableType,
  TableWithPid,
  SocketID,
  TableID,
  UserID,
  ExtendedSocket,
  FlushTableRequest,
  TransporterProviders,
} from '@lib/fabzen-common/types';
import { JSONParserPipe } from '@lib/fabzen-common/pipes/json-parser.pipe';
import { verifyJwtTokenInSocketIo } from '@lib/fabzen-common/utils/jwt.util';
import { WsMaintenanceGuard } from '@lib/fabzen-common/guards/ws-maintenance.guard';
// import { UserGuard } from '@lib/fabzen-common/guards/ws-user.guard';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

import { WsJwtGuard } from '@lib/fabzen-common/guards/ws-jwt.guard';
import { SpGameplayController } from './sp-gameplay.controller';
import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { CommonService, TableService } from './services/gameplay';
import { getMatchingTimeout, leaveLogs } from './utils/sp-gameplay.utils';
import { SpQueueService, WaitingTableQueueService } from './services/queue';
import { config } from '@lib/fabzen-common/configuration';
import { RedisService } from './services/transient-db/redis/service';
import { isEqual } from 'lodash';
import {
  BuyInResponse,
  EmojiData,
  JoinTableRequest,
  MessageData,
  RaiseMessage,
  RebuyMessage,
  SideShowResponse,
} from './sp-gameplay.dto';
import { AuthenticatedSocket } from '@lib/fabzen-common/types/socket.types';
import { NotificationProvider } from 'apps/notification/src/notification.provider';
import { ClientProxy } from '@nestjs/microservices';
import { SocketGatewayProvider } from 'apps/socket-gateway/src/socket-gateway.provider';

@UseGuards(WsJwtGuard)
@UsePipes(new JSONParserPipe())
@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class SpGameplayGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() wss!: Server;
  private readonly notificationProvider: NotificationProvider;
  private readonly socketGatewayProvider: SocketGatewayProvider;

  constructor(
    @Inject(forwardRef(() => SpGameplayController))
    private readonly spGameplayController: SpGameplayController,
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
    @Inject(forwardRef(() => SpQueueService))
    private readonly spQueueService: SpQueueService,
    private readonly remoteConfigService: RemoteConfigService,
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
    @Inject(TransporterProviders.SOCKET_GATEWAY_SERVICE)
    private socketGatewayClient: ClientProxy,
  ) {
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );
    this.socketGatewayProvider = new SocketGatewayProvider(
      this.socketGatewayClient,
    );
  }

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
        if (status === GameStatus.waiting) {
          client.emit('reconnectGame', {
            gameStatus: status,
            ...waitingInfo,
            isReconnected: true,
          });
        } else if (table) {
          client.join(tableId);
          const reconnectTableResponse = this.tableService.handleTableResponse(
            table,
            userId,
          );
          client.emit('reconnectGame', {
            ...reconnectTableResponse,
            isReconnected: true,
          });

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
      this.commonService.unlockUser(userId);
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
    { tableId }: FlushTableRequest,
  ) {
    await this.destroyInactiveTable(tableId);

    leaveLogs('flushTable', { tableId });
    client.emit('flushTable', {
      message: `Table removed in Redis: ${tableId}`,
    });
  }

  /**
   * Join Table
   */
  // @UseGuards(UserGuard)
  @UseGuards(WsMaintenanceGuard)
  @WsSubscribeMessage('joinTable')
  async onJoinTableEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(JoinTableRequest) { tableType }: JoinTableRequest,
  ) {
    const { user, id: socketId } = client;
    const userId = user.userId;

    await this.transientDBService.setUserSocketId(userId, socketId);

    // leave logs
    leaveLogs(`Gameplay log ${userId} ${GameLog.joinTable}`, {
      userId,
      action: GameLog.joinTable,
      type: LogType.request,
      payload: {
        tableType,
      },
    });

    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    try {
      const walletBalance = await this.spGameplayController.joinTable({
        tableType,
        userId,
      });
      client.emit('buyInReq', { walletBalance });

      // leave logs
      leaveLogs(`Gameplay log ${userId} ${GameLog.buyInRequest}`, {
        userId,
        action: GameLog.buyInRequest,
        type: LogType.response,
        payload: {
          tableType,
        },
      });
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${userId} ${GameLog.buyInRequest}`, {
        userId,
        action: GameLog.joinTable,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      this.commonService.unlockUser(userId);
    }
  }

  async startRound(tableId: string) {
    leaveLogs('startRound create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('startRound lock', { tableId, pid });

    let timeout: any;
    try {
      if (
        table.gameStatus !== GameStatus.waiting &&
        table.gameStatus !== GameStatus.roundEnded
      ) {
        throw new BadRequestException(
          { gameStatus: table.gameStatus },
          'Game is already started',
        );
      }

      // initialize table
      table.chaalAmount = table.tableType.initialBetAmount;
      table.dealerId =
        table.turnNo === 0
          ? PlayerId.pl1
          : this.tableService.getNextDealer(table);
      table.currentTurn = table.dealerId;
      table.hidden = true;
      table.potAmount = '0';
      delete table.commonCard;
      delete table.roundEndInfo;
      timeout = dayjs()
        .add(config.spGameplay.startTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      table.players.map((player) => {
        delete player.firstCard;
        delete player.hiddenCards;
        player.active =
          this.commonService
            .getSubWalletBalance(player.amount)
            .gt(Big(table.tableType.initialBetAmount)) && !player.rebuying;
        player.betAmount = '0';
        player.lastBetAmount = '0';
        player.sidepot = '0';
        player.seen = false;
        player.allin = false;
        player.chaalAfterSeen = false;
        player.roundAmount = this.commonService
          .getSubWalletBalance(player.amount)
          .toString();
      });
      table.roundNo++;
      table.gameStatus = GameStatus.roundStarted;
      table.roundStartedAt = dayjs().toISOString();
      await this.tableService.updateTable(table, pid);
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${tableId} ${GameLog.startRound}`, {
        tableId,
        action: GameLog.joinTable,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('startRound unlock', { tableId, pid });
    }

    // delete walletBalance from response
    const { joinNo, turnNo, playersAmount, ...tableResponse } = table;
    const tableData: any = { ...tableResponse };
    tableData.players = tableResponse.players.map((player) => {
      const { betAmount, startAmount, roundAmount, ...playerResponse } = player;
      return playerResponse;
    });
    tableData.players = tableData.players.map((player: any) => {
      player.amount = this.commonService.getSubWalletSum(player.amount);
      return player;
    });

    table.players.map(async (player) => {
      const socketId = (await this.transientDBService.getUserSocketId(
        player.userId,
      )) as SocketID;

      const startRoundResponse = { ...tableData };
      startRoundResponse.players = startRoundResponse.players.map(
        (playerData: any) => {
          if (playerData.userId === player.userId) {
            playerData.walletBalance = this.commonService.getSubWalletBalance(
              playerData.walletBalance,
            );
            return playerData;
          } else {
            const { walletBalance, ...response } = playerData;
            return response;
          }
        },
      );

      this.wss.to(socketId).emit('roundStarted', {
        ...startRoundResponse,
        myPlayerId: player.playerId,
        timeout,
        serverTime: dayjs().toISOString(),
      });
    });

    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.startRound}`, {
      tableId,
      action: GameLog.startRound,
      type: LogType.response,
      payload: {
        table,
        serverTime: dayjs().toISOString(),
      },
    });

    this.spQueueService.addTimeoutAction(
      table.tableId,
      GameAction.initialBet,
      config.spGameplay.startTimeout,
    );
  }

  /**
   * Initial Betting of the table after the 5 secs timeout
   */
  async initialBet(tableId: string) {
    leaveLogs('initialBet create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('initialBet lock', { tableId, pid });
    try {
      if (
        table.gameStatus === GameStatus.roundEnded ||
        table.gameStatus === GameStatus.gameEnded
      ) {
        leaveLogs('initialBet game status', {
          gameStatus: table.gameStatus,
        });
        await this.redisService.releaseLock(tableId, pid);
        leaveLogs('initialBet unlock', { tableId, pid });
        return;
      }
      if (table.gameStatus !== GameStatus.roundStarted) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('The game is not in roundStarted');
      }
      table.players.map((player) => {
        if (player.active && player.amount) {
          player.amount = this.commonService.debitSubWallet(
            player.amount,
            table.tableType.initialBetAmount,
          );
          player.betAmount = table.tableType.initialBetAmount;
          player.lastBetAmount = '0';
          if (!table.potAmount) {
            table.potAmount = '0';
          }
          table.potAmount = Big(table.potAmount)
            .plus(Big(table.tableType.initialBetAmount))
            .toString();
        }
      });
      table.chaalAmount = table.tableType.initialBetAmount;
      table.gameStatus = GameStatus.initialBet;
      const timeout = dayjs()
        .add(config.spGameplay.initialBetTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      await this.tableService.updateTable(table, pid);

      this.wss
        .to(table.tableId)
        .emit('initialBet', { status: GameStatus.initialBet, timeout });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.initialBet}`, {
        tableId,
        action: GameLog.initialBet,
        type: LogType.response,
        payload: {
          table,
        },
      });

      // this.commonService.updateReferralAmount(table);
      this.spQueueService.addTimeoutAction(
        table.tableId,
        GameAction.dealCards,
        config.spGameplay.initialBetTimeout,
      );
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.initialBet}`, {
        tableId,
        action: GameLog.initialBet,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('initialBet unlock', { tableId, pid });
      // leaveLogs('initialBet exception unlock', { tableId, pid });
    }
  }

  /**
   * Dealing cards after initial betting of the table
   */
  async dealCards(tableId: string) {
    leaveLogs('dealCards create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('dealCards lock', { tableId, pid });
    if (
      table.gameStatus === GameStatus.roundEnded ||
      table.gameStatus === GameStatus.gameEnded
    ) {
      leaveLogs('dealCards game status', {
        gameStatus: table.gameStatus,
      });
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('dealCards unlock', { tableId, pid });
      return;
    }
    try {
      const dealtTable = await this.tableService.dealCards(table);
      const activePlayers = this.tableService.getActivePlayers(dealtTable);
      const timeout = dayjs().add(activePlayers.length, 'second').toISOString();
      table.timeout = timeout;
      await this.tableService.updateTable(dealtTable, pid);
      leaveLogs('dealCards unlock', { tableId, pid });

      await Promise.all(
        dealtTable.players.map(async (player) => {
          const socketId = (await this.transientDBService.getUserSocketId(
            player.userId,
          )) as SocketID;
          if (!player.active) {
            this.wss.to(socketId).emit('dealCards', { timeout });
            return;
          }
          this.wss
            .to(socketId)
            .emit('dealCards', { firstCard: player.firstCard, timeout });
        }),
      );

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.dealCards}`, {
        tableId,
        action: GameLog.dealCards,
        type: LogType.response,
        payload: {
          table,
        },
      });
      this.spQueueService.addTimeoutAction(
        table.tableId,
        GameAction.startPlaying,
        activePlayers.length,
      );
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.dealCards}`, {
        tableId,
        action: GameLog.dealCards,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      // leaveLogs('dealCards exception unlock', { tableId, pid });
    }
  }

  /**
   * Request to Leave Game Table
   */
  @WsSubscribeMessage('leaveTable')
  async onLeaveTableEvent(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    try {
      const tableId =
        await this.transientDBService.getUserActiveTableId(userId);
      if (tableId) {
        await this.leaveTable(tableId, userId, true);
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
      leaveLogs(`Gameplay log ${userId} ${GameLog.leaveTable}`, {
        action: GameLog.leaveTable,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('leaveWaitingTable')
  async onLeaveWaitingEvent(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
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
      await this.spGameplayController.leaveWaitingTable(userId);
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${userId} ${GameLog.leaveWaitingTable}`, {
        userId,
        action: GameLog.leaveWaitingTable,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      this.commonService.unlockUser(userId);
    }
  }

  /**
   * BuyIn Response from FE
   */
  // @UseGuards(UserGuard)
  @UseGuards(WsMaintenanceGuard)
  @WsSubscribeMessage('buyInRes')
  async onBuyInRes(
    @WsClient() client: ExtendedSocket,
    @WsData(BuyInResponse) { tableType, amount }: BuyInResponse,
  ) {
    const userId = client.user.userId;
    // leave logs
    leaveLogs(`Gameplay log ${userId} ${GameLog.buyInResponse}`, {
      userId,
      action: GameLog.buyInResponse,
      type: LogType.request,
    });

    // check if the tableType is correct
    const tableInfo = await this.remoteConfigService.getSpTableInfos();

    const tableTypeConfig = tableInfo.find(
      (table: any) => table.tableTypeId === tableType.tableTypeId,
    );
    if (!isEqual(tableType, tableTypeConfig)) {
      throw new BadRequestException('tableType is inconsistent with config');
    }

    // check if wallet balance and amount is acceptable
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    try {
      const { walletBalance, subWallet } =
        await this.commonService.checkWalletBalance(userId, amount);
      const doubleJoined = await this.tableService.checkDoubleJoin(
        tableType,
        userId,
      );
      if (doubleJoined) {
        throw new BadRequestException(`Only one table can be joined at a time`);
      }
      if (Big(walletBalance.main).lt('0')) {
        throw new BadRequestException(`Wallet balance is not enough`);
      }
      if (Big(amount).lt(tableType.minJoinAmount)) {
        throw new BadRequestException(`Amount is not sufficient to join`);
      }
      if (Big(amount).lte(Big('0'))) {
        throw new BadRequestException(`Amount can not be negative`);
      }
      const matchingTimeout = getMatchingTimeout(tableType);
      const timeout = dayjs().add(matchingTimeout, 'second').toISOString();
      client.emit('matchingTimeout', {
        timeout,
        serverTime: dayjs().toISOString(),
      });
      // leave logs
      leaveLogs(`Gameplay log ${userId} ${GameLog.matchingTimeout}`, {
        userId,
        action: GameLog.matchingTimeout,
        type: LogType.response,
        payload: {
          tableType,
          amount,
          timeout,
          serverTime: dayjs().toISOString(),
        },
      });

      const isMaintenanceBypass =
        client.handshake.headers.key === config.auth.maintenanceBypassKey;

      await this.waitingTableQueueService.addToQueue(
        tableType,
        userId,
        subWallet,
        walletBalance,
        isMaintenanceBypass,
      );

      const matchMakingNotifications =
        this.remoteConfigService.getSpMatchMakingNotificationConfig();
      if (
        Number(tableType.minJoinAmount) >=
        Number(matchMakingNotifications.minimumJoinAmountForNotifications)
      ) {
        const userIds = await this.transientDBService.getBigTableUsers();
        // exclude my userId
        const otherUserIds = userIds.filter((id) => id !== userId);
        console.log('matchmaking', userIds);
        if (
          matchMakingNotifications.isPushNotificationsEnabled &&
          otherUserIds.length > 0
        ) {
          await this.sendMatchMakingPushNotification(
            otherUserIds,
            tableType.minJoinAmount,
          );
        }
        if (
          matchMakingNotifications.isSocketNotificationsEnabled &&
          otherUserIds.length > 0
        ) {
          await this.sendMatchMakingSocketNotification(
            otherUserIds,
            tableType.minJoinAmount,
          );
        }
      }
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${userId} ${GameLog.buyInResponse}`, {
        userId,
        action: GameLog.buyInResponse,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      this.commonService.unlockUser(userId);
    }
  }

  async sendMatchMakingPushNotification(userIds: string[], joinFee: string) {
    const pnTitle = 'Play Now ‼️';
    const pnContent = `Oh no! You could not find a player. Don't worry. 😊
    Players are now available 🙋 at the ${joinFee} table. 😍
    Tap here to play! ✌️`;
    const deepLink = `emp://SkillPatti/JoinTable=${joinFee}`;
    await this.notificationProvider.sendMassPushNotifications(
      userIds,
      pnTitle,
      pnContent,
      deepLink,
    );
  }

  async sendMatchMakingSocketNotification(userIds: string[], joinFee: string) {
    const deepLink = `emp://SkillPatti/JoinTable=${joinFee}`;
    await this.socketGatewayProvider.sendMatchMakingSocketNotification(
      userIds,
      deepLink,
    );
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
    const userInfo = await this.transientDBService.getUserWaitingTable(userId);
    await this.spGameplayController.leaveWaitingTable(userId, true);

    client.emit('checkIfJoinedRes', { status });

    if (
      !status &&
      userInfo &&
      Number(userInfo.tableType.minJoinAmount) >=
        Number(
          this.remoteConfigService.getSpMatchMakingNotificationConfig()
            .minimumJoinAmountForNotifications,
        )
    ) {
      await this.transientDBService.setBigTableUser(userId);
    }

    // leave logs
    leaveLogs(`Gameplay log ${userId} ${GameLog.checkIfJoined}`, {
      userId,
      action: GameLog.checkIfJoined,
      type: LogType.response,
      payload: { status },
    });
  }

  @WsSubscribeMessage('chaal')
  async chaal(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.chaal}`, {
      tableId,
      userId,
      action: GameLog.chaal,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException({ userId }, 'TableId not found for user');
    }
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    leaveLogs('chaal create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('chaal lock', { tableId, pid });

    try {
      if (table.gameStatus !== GameStatus.playing) {
        throw new BadRequestException('Table is not in playing status');
      }
      await this.chaalBet(table, userId, pid);

      // decide if there is winner
      const activePlayers = this.tableService.getActivePlayers(table);
      const lastBetAmount = activePlayers[0].lastBetAmount;
      const tableChaalAmount = table.chaalAmount;
      if (
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(tableChaalAmount))) ||
        Big(table.potAmount).gte(Big(table.tableType.potLimit))
      ) {
        this.roundEnd(table.tableId);
        return;
      }

      this.next(table.tableId);
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.chaal}`, {
        tableId,
        userId,
        action: GameLog.chaal,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      leaveLogs('chaal unlock', { tableId: table.tableId, pid });
      this.redisService.releaseLock(tableId, pid);
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('pack')
  async packCards(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.pack}`, {
      tableId,
      userId,
      action: GameLog.pack,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException('TableId not found for user');
    }

    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    leaveLogs('pack create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('pack lock', { tableId, pid });
    await this.redisService.releaseLock(tableId, pid);
    leaveLogs('pack unlock', { tableId, pid });

    try {
      if (table.gameStatus !== GameStatus.playing) {
        throw new BadRequestException(
          { status: table.gameStatus },
          'The table is not in playing status',
        );
      }

      const playerIndex = this.tableService.getCurrentPlayerIndex(table);
      if (table.players[playerIndex].userId !== userId) {
        throw new BadRequestException("Not the player's turn");
      }
      table.skipTurnNo = 0;
      this.pack(table.tableId);
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.pack}`, {
        tableId,
        userId,
        action: GameLog.pack,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      leaveLogs('pack exception unlock', { tableId, pid });
      this.redisService.releaseLock(tableId, pid);
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('raise')
  async raise(
    @WsClient() client: ExtendedSocket,
    @WsData(RaiseMessage) { amount }: RaiseMessage,
  ) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.raise}`, {
      tableId,
      userId,
      action: GameLog.raise,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException({ userId }, 'TableId not found for user');
    }
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    leaveLogs('raise create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;

    leaveLogs('raise lock', { tableId, pid });

    try {
      const currentPlayerIndex = table.players.findIndex(
        (player) => player.userId === userId,
      );
      const player = table.players[currentPlayerIndex];
      if (table.gameStatus !== GameStatus.playing) {
        throw new BadRequestException('Table is not in playing status');
      }
      if (!player.active) {
        throw new BadRequestException(
          'Inactive player should not able to play',
        );
      }
      if (table.gameStatus !== GameStatus.playing) {
        throw new BadRequestException(
          { status: table.gameStatus },
          'The table is not in playing status',
        );
      }
      if (player.playerId !== table.currentTurn) {
        throw new BadRequestException("Not the player's turn");
      }
      const playerBalance = this.commonService.getSubWalletBalance(
        player.amount,
      );
      if (Big(amount).gte(playerBalance)) {
        throw new BadRequestException('Not enough balance for raise');
      }
      if (Big(amount).lte(Big('0'))) {
        throw new BadRequestException('Raise Amount is less than 0');
      }
      const chaalAmount =
        player.seen && table.hidden
          ? Big(table.chaalAmount as string)
              .mul(2)
              .toString()
          : (table.chaalAmount as string);
      const limitAmount = Big(table.tableType.potLimit).minus(
        Big(table.potAmount),
      );
      if (
        limitAmount.gte(Big(chaalAmount)) &&
        Big(amount).lte(Big(chaalAmount))
      ) {
        throw new BadRequestException(
          'Raise amount should be bigger than chaal amount',
        );
      }
      if (Big(amount).gt(limitAmount)) {
        throw new BadRequestException('Raise amount exceeds limitAmount');
      }

      table.players[currentPlayerIndex].betAmount = Big(
        player.betAmount as string,
      )
        .plus(Big(amount))
        .toString();
      table.players[currentPlayerIndex].amount =
        this.commonService.debitSubWallet(player.amount, amount);
      table.players[currentPlayerIndex].lastBetAmount = amount;
      table.chaalAmount = amount;
      table.potAmount = Big(table.potAmount as string)
        .plus(Big(amount))
        .toString();
      table.turnNo++;
      table.skipTurnNo = 0;

      // decide if there is winner
      const activePlayers = this.tableService.getActivePlayers(table);
      const lastBetAmount = activePlayers[0].lastBetAmount as string;
      const tableChaalAmount = table.chaalAmount as string;
      if (
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(tableChaalAmount))) ||
        Big(table.potAmount).gte(Big(table.tableType.potLimit))
      ) {
        table.gameStatus = GameStatus.roundEnded;
      }

      await this.tableService.updateTable(table, pid);
      leaveLogs('raise unlock', { tableId, pid });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.raise}`, {
        tableId: tableId,
        userId,
        playerId: table.players[currentPlayerIndex].playerId,
        action: GameLog.raise,
        payload: {
          playerId: player.playerId,
          amount,
          playerAmount: this.commonService
            .getSubWalletBalance(table.players[currentPlayerIndex].amount)
            .toString(),
          potAmount: table.potAmount,
          chaalAmount: table.chaalAmount,
          table,
        },
      });

      this.wss.to(tableId).emit('playerRaise', {
        playerId: player.playerId,
        amount,
        playerAmount: this.commonService
          .getSubWalletBalance(table.players[currentPlayerIndex].amount)
          .toString(),
        potAmount: table.potAmount,
        chaalAmount: table.chaalAmount,
      });

      // decide if there is winner
      if (
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(tableChaalAmount))) ||
        Big(table.potAmount).gte(Big(table.tableType.potLimit))
      ) {
        this.roundEnd(table.tableId);
        return;
      }

      this.next(table.tableId);
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.raise}`, {
        tableId,
        userId,
        action: GameLog.raise,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      this.redisService.releaseLock(tableId, pid);
      leaveLogs('raise exception unlock', { tableId, pid });
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('allin')
  async allin(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.allin}`, {
      tableId,
      userId,
      action: GameLog.allin,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException({ userId }, 'TableId not found for user');
    }
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);
    leaveLogs('allin create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('allin lock', { tableId, pid });

    try {
      if (table.gameStatus !== GameStatus.playing) {
        throw new BadRequestException('Table is not in playing status');
      }
      const currentPlayerIndex = table.players.findIndex(
        (player) => player.userId === userId,
      );
      const player = { ...table.players[currentPlayerIndex] };

      if (!player.active) {
        throw new BadRequestException('Inactive player is not able to play');
      }
      if (table.gameStatus !== GameStatus.playing) {
        throw new BadRequestException(
          { status: table.gameStatus },
          'The table is not in playing status',
        );
      }
      if (player.playerId !== table.currentTurn) {
        throw new BadRequestException("Not the player's turn");
      }
      if (!player.seen) {
        client.emit('seeCardRes', { hiddenCards: player.hiddenCards });
      }

      const playerBalance = this.commonService.getSubWalletBalance(
        player.amount,
      );
      const limitAmount = Big(table.tableType.potLimit)
        .minus(Big(table.potAmount))
        .toString();
      if (Big(playerBalance).gt(Big(limitAmount))) {
        throw new BadRequestException(
          'Player balance is greater than limitAmount',
        );
      }
      table.players[currentPlayerIndex].betAmount = Big(player.betAmount)
        .plus(playerBalance)
        .toString();
      table.players[currentPlayerIndex].amount =
        this.commonService.debitSubWallet(
          player.amount,
          playerBalance.toString(),
        );
      table.players[currentPlayerIndex].lastBetAmount =
        playerBalance.toString();
      table.players[currentPlayerIndex].active = false;
      table.players[currentPlayerIndex].allin = true;
      table.players[currentPlayerIndex].seen = true;
      table.players[currentPlayerIndex].sidepot = Big(table.potAmount)
        .plus(playerBalance)
        .toString();
      if (Big(playerBalance).gt(Big(table.chaalAmount))) {
        table.chaalAmount = playerBalance.toString();
      }
      table.potAmount = Big(table.potAmount).plus(playerBalance).toString();
      table.skipTurnNo = 0;
      table.turnNo++;
      // decide if there is winner
      const activePlayers = this.tableService.getActivePlayers(table);
      if (
        activePlayers.length === 0 ||
        (activePlayers.length === 1 &&
          Big(activePlayers[0].lastBetAmount).gte(Big(table.chaalAmount))) ||
        Big(table.potAmount).gte(Big(table.tableType.potLimit))
      ) {
        table.gameStatus = GameStatus.roundEnded;
      }
      await this.tableService.updateTable(table, pid);
      // leaveLogs('allin unlock', { tableId, pid });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.allin}`, {
        tableId,
        userId,
        playerId: table.players[currentPlayerIndex].playerId,
        type: LogType.response,
        action: GameLog.allin,
        payload: {
          playerId: player.playerId,
          amount: playerBalance,
          playerAmount: '0',
          potAmount: table.potAmount,
          sidepot: table.potAmount,
          chaalAmount: table.chaalAmount,
          table,
        },
      });

      this.wss.to(tableId).emit('playerAllin', {
        playerId: player.playerId,
        amount: playerBalance,
        playerAmount: '0',
        potAmount: table.potAmount,
        sidepot: table.potAmount,
        chaalAmount: table.chaalAmount,
      });

      // reveal cards
      if (activePlayers.every((player) => player.seen) && table.hidden) {
        await this.revealCards(table.tableId);
      }

      // decide if there is winner
      if (
        activePlayers.length === 0 ||
        (activePlayers.length === 1 &&
          Big(activePlayers[0].lastBetAmount).gte(Big(table.chaalAmount))) ||
        Big(table.potAmount).gte(Big(table.tableType.potLimit))
      ) {
        this.roundEnd(tableId);
        return;
      }

      this.next(tableId);
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.allin}`, {
        tableId,
        userId,
        action: GameLog.allin,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      leaveLogs('allin unlock', { tableId, pid });
      this.redisService.releaseLock(tableId, pid);
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('see')
  async see(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.see}`, {
      tableId,
      userId,
      action: GameLog.see,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException('TableId not found for user');
    }
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    leaveLogs('see create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('see lock', { tableId, pid });

    try {
      if (
        table.gameStatus !== GameStatus.playing &&
        table.gameStatus !== GameStatus.sideshow
      ) {
        throw new BadRequestException('The table is not in playing status');
      }
      const currentPlayerIndex = table.players.findIndex(
        (player) => player.userId === userId,
      );
      const player = table.players[currentPlayerIndex];
      if (!player.active) {
        throw new BadRequestException(
          'Inactive player should not able to play',
        );
      }

      table.skipTurnNo = 0;
      table.players[currentPlayerIndex].seen = true;

      const activePlayers = this.tableService.getActivePlayers(table);
      const chaalAfterSeen = !activePlayers.every((player) => player.seen);
      table.players[currentPlayerIndex].chaalAfterSeen = chaalAfterSeen;

      await this.tableService.updateTable(table, pid);
      leaveLogs('see unlock', { tableId, pid });

      client.emit('seeCardRes', {
        hiddenCards: player.hiddenCards,
        chaalAfterSeen,
      });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.see}`, {
        tableId,
        userId,
        playerId: player.playerId,
        action: GameLog.see,
        type: LogType.response,
        payload: {
          hiddenCards: player.hiddenCards,
          table,
        },
      });

      this.wss.to(tableId).emit('playerSeeCard', {
        playerId: player.playerId,
      });

      // reveal cards
      if (activePlayers.every((player) => player.seen) && table.hidden) {
        await this.revealCards(table.tableId);
      }
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.see}`, {
        tableId,
        userId,
        action: GameLog.see,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      leaveLogs('see exception unlock', { tableId, pid });
      this.redisService.releaseLock(tableId, pid);
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('rebuyRes')
  async rebuy(
    @WsClient() client: ExtendedSocket,
    @WsData(RebuyMessage) { amount }: RebuyMessage,
  ) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.rebuyResponse}`, {
      tableId,
      userId,
      action: GameLog.rebuyResponse,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException({ userId }, 'TableId not found for user');
    }
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    leaveLogs('rebuyRes create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('rebuyRes lock', { tableId, pid });

    try {
      const currentPlayerIndex = table.players.findIndex(
        (player) => player.userId === userId,
      );
      const player = table.players[currentPlayerIndex];

      const { walletBalance, subWallet } =
        this.commonService.checkRebuyWalletBalance(
          player.walletBalance,
          amount,
        );
      if (Big(walletBalance.main).lt('0')) {
        throw new BadRequestException(
          'Rebuy amount is greater than wallet balance',
        );
      }
      player.walletBalance = walletBalance;
      player.amount.main = Big(player.amount.main)
        .plus(subWallet.main)
        .toString();
      player.amount.winning = Big(player.amount.winning)
        .plus(subWallet.winning)
        .toString();
      player.amount.bonus = Big(player.amount.bonus)
        .plus(subWallet.bonus)
        .toString();
      player.rebuying = false;

      this.commonService.debitTable([player.userId], [subWallet], tableId);
      await this.tableService.updateTable(table, pid);
      leaveLogs('rebuyRes unlock', { tableId, pid });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.rebuyResponse}`, {
        tableId,
        userId,
        playerId: player.playerId,
        action: GameLog.rebuyResponse,
        type: LogType.response,
        payload: {
          amount,
          table,
        },
      });
      this.wss.to(tableId).emit('playerRebuy', {
        playerId: player.playerId,
        amount: this.commonService.getSubWalletSum(player.amount),
      });

      if (
        table.players.filter((player) => !player.rebuying).length === 2 &&
        table.gameStatus === GameStatus.roundEnded &&
        table.roundEndInfo
      ) {
        this.startRound(table.tableId);
      }
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.rebuyResponse}`, {
        tableId,
        userId,
        action: GameLog.rebuyResponse,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      // leaveLogs('rebuyRes exception unlock', { tableId, pid });
      this.redisService.releaseLock(tableId, pid);
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('showdown')
  async showdown(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.showdown}`, {
      tableId,
      userId,
      action: GameLog.showdown,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException({ userId }, 'TableId not found for user');
    }
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    leaveLogs('showdown create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('showdown lock', { tableId, pid });

    try {
      const activePlayers = this.tableService.getActivePlayers(table);
      if (activePlayers.length !== 2) {
        throw new BadRequestException(
          'Showdown can be called only when two players are active',
        );
      }

      const currentPlayerIndex = table.players.findIndex(
        (player) => player.userId === userId,
      );
      const player = table.players[currentPlayerIndex];
      const chaalAmount =
        player.seen && table.hidden
          ? Big(table.chaalAmount as string)
              .mul(2)
              .toString()
          : (table.chaalAmount as string);
      const limitAmount = Big(table.tableType.potLimit)
        .minus(Big(table.potAmount))
        .toString();
      if (Big(limitAmount).lte(Big(chaalAmount))) {
        throw new BadRequestException(
          'chaalAmount is not greater than limitAmount',
        );
      }
      table.gameStatus = GameStatus.showdown;
      await this.chaalBet(table, userId, pid);

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.showdown}`, {
        tableId,
        userId,
        playerId: table.currentTurn,
        action: GameLog.showdown,
        type: LogType.response,
        playload: { table },
      });
      this.wss.to(tableId).emit('showdown', { playerId: table.currentTurn });

      this.roundEnd(table.tableId);
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.showdown}`, {
        tableId,
        userId,
        action: GameLog.showdown,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      leaveLogs('showdown exception unlock', { tableId, pid });
      this.redisService.releaseLock(tableId, pid);
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('sideshow')
  async sideshow(@WsClient() client: ExtendedSocket) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowStart}`, {
      tableId,
      userId,
      action: GameLog.sideshowStart,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException({ userId }, 'TableId not found for user');
    }
    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    leaveLogs('sideshow create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('sideshow lock', { tableId, pid });

    try {
      if (table.gameStatus !== GameStatus.playing) {
        throw new BadRequestException('Game is not in playing status');
      }
      const activePlayers = this.tableService.getActivePlayers(table);
      if (activePlayers.length < 3) {
        throw new BadRequestException(
          'There should be minimum 3 active players in the table',
        );
      }

      const currentPlayerIndex = table.players.findIndex(
        (player) => player.userId === userId,
      );
      const player = table.players[currentPlayerIndex];
      const previousPlayerIndex = this.tableService.getPrevPlayerIndex(table);
      const previousPlayer = table.players[previousPlayerIndex];

      const chaalAmount =
        player.seen && table.hidden
          ? Big(table.chaalAmount as string)
              .mul(2)
              .toString()
          : (table.chaalAmount as string);
      const limitAmount = Big(table.tableType.potLimit)
        .minus(Big(table.potAmount))
        .toString();
      if (Big(limitAmount).lte(Big(chaalAmount))) {
        throw new BadRequestException(
          'chaalAmount is not greater than limitAmount',
        );
      }

      if (!player.seen || !previousPlayer.seen) {
        throw new BadRequestException('Players cards should be revealed');
      }
      table.gameStatus = GameStatus.sideshow;
      const timeout = dayjs()
        .add(config.spGameplay.turnTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      table.turnNo++;
      await this.chaalBet(table, userId, pid);

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowStart}`, {
        tableId,
        userId,
        playerId: player.playerId,
        action: GameLog.sideshowStart,
        type: LogType.request,
        payload: {
          startPlayerId: player.playerId,
          receivePlayerId: previousPlayer.playerId,
          timeout,
          table,
        },
      });
      this.wss.to(tableId).emit('sideshowStart', {
        startPlayerId: player.playerId,
        receivePlayerId: previousPlayer.playerId,
        timeout,
      });
      this.spQueueService.addTimeoutAction(
        tableId,
        GameAction.sideshow,
        config.spGameplay.turnTimeout,
        {
          turnNo: table.turnNo,
          roundNo: table.roundNo,
          receiveUserId: previousPlayer.userId,
        },
      );
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowStart}`, {
        tableId,
        userId,
        action: GameLog.sideshowStart,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      leaveLogs('sideshow unlock', { tableId, pid });
      this.redisService.releaseLock(tableId, pid);
      this.commonService.unlockUser(userId);
    }
  }

  @WsSubscribeMessage('sideshowRes')
  async sideshowRes(
    @WsClient() client: ExtendedSocket,
    @WsData(SideShowResponse) { accepted }: SideShowResponse,
  ) {
    const userId = client.user.userId;
    const tableId = await this.transientDBService.getUserActiveTableId(userId);
    // leave logs
    leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowResponse}`, {
      tableId,
      userId,
      action: GameLog.sideshowResponse,
      type: LogType.request,
    });
    if (!tableId) {
      throw new NotFoundException({ userId }, 'TableId not found for user');
    }

    await this.commonService.checkUserLock(userId);
    await this.commonService.lockUser(userId);

    leaveLogs('sideshowRes create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('sideshowRes lock', { tableId, pid });

    try {
      if (table.gameStatus !== GameStatus.sideshow) {
        leaveLogs('Table status is not sideshow', {});
        await this.commonService.unlockUser(userId);
        await this.redisService.releaseLock(tableId, pid);
        return;
      }
      table.sideshowAccepted = accepted;
      table.turnNo++;
      table.gameStatus = GameStatus.playing;

      const player = table.players.find((player) => player.userId === userId);
      const previousPlayerIndex = this.tableService.getPrevPlayerIndex(table);
      const receivePlayer = table.players[previousPlayerIndex];
      const receivePlayerId = receivePlayer.playerId;
      if (player?.playerId !== receivePlayerId) {
        throw new BadRequestException('Not the player turn for sideshowRes');
      }
      const startPlayerId = table.currentTurn;

      if (accepted) {
        const sideshowResult = this.commonService.sideShow(
          table,
          startPlayerId,
          receivePlayerId,
        );
        const startPlayer = table.players.find(
          (player) => player.playerId === startPlayerId,
        );
        if (sideshowResult.winner !== '') {
          const loserId =
            sideshowResult.winner === startPlayerId
              ? receivePlayer.userId
              : startPlayer?.userId;
          table.players.map((player) => {
            if (player.userId === loserId) {
              player.active = false;
            }
          });
        }
      }

      const nextPlayer = this.tableService.getNextActivePlayer(table);
      const nextTurn = nextPlayer.playerId;
      table.currentTurn = nextTurn;
      const timeout = dayjs()
        .add(config.spGameplay.sideshowTimeout, 'second')
        .toISOString();
      table.timeout = timeout;

      await this.tableService.updateTable(table, pid);
      leaveLogs('sideshowRes unlock', { tableId, pid });

      if (accepted) {
        const sideshowResult = this.commonService.sideShow(
          table,
          startPlayerId,
          receivePlayerId,
        );
        leaveLogs('sideshow result', { sideshowResult });

        // send result to the players who participated in sideshow
        const startPlayer = table.players.find(
          (player) => player.playerId === startPlayerId,
        );
        const socketId = (await this.transientDBService.getUserSocketId(
          startPlayer?.userId as UserID,
        )) as SocketID;
        this.wss.to(socketId).emit('sideshowResult', {
          ...sideshowResult,
          startPlayerId,
          receivePlayerId,
          cards: [
            receivePlayer?.firstCard,
            ...(receivePlayer?.hiddenCards as [Card, Card]),
          ],
          timeout: table.timeout,
        });
        client.emit('sideshowResult', {
          ...sideshowResult,
          startPlayerId,
          receivePlayerId,
          cards: [
            startPlayer?.firstCard,
            ...(startPlayer?.hiddenCards as [Card, Card]),
          ],
          timeout: table.timeout,
        });

        // leave logs
        leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowAccepted}`, {
          tableId,
          userId,
          playerId: player.playerId,
          action: GameLog.sideshowAccepted,
          type: LogType.response,
          payload: {
            ...sideshowResult,
            startPlayerId,
            receivePlayerId,
            cards: [
              startPlayer?.firstCard,
              ...(startPlayer?.hiddenCards as [Card, Card]),
            ],
            table,
          },
        });

        // send result to other players
        this.wss
          .to(tableId)
          .except([socketId, client.id])
          .emit('sideshowAccepted', {
            startPlayerId,
            receivePlayerId,
            timeout: table.timeout,
            winner: sideshowResult.winner,
          });

        // pack loser
        if (sideshowResult.winner !== '') {
          const loserId =
            sideshowResult.winner === startPlayerId
              ? receivePlayer.userId
              : startPlayer?.userId;

          this.spQueueService.addTimeoutAction(
            tableId,
            GameAction.sideshowAccept,
            config.spGameplay.sideshowTimeout,
            loserId,
          );
          return;
        }
      } else {
        leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowRejected}`, {
          tableId,
          userId,
          playerId: player.playerId,
          action: GameLog.sideshowRejected,
          payload: {
            startPlayerId,
            receivePlayerId,
            timeout: table.timeout,
            table,
          },
        });
        this.wss.to(tableId).emit('sideshowRejected', {
          startPlayerId,
          receivePlayerId,
          timeout: table.timeout,
        });
        leaveLogs('sideshowRejected', { startPlayerId, receivePlayerId });
      }
      this.spQueueService.addTimeoutAction(
        tableId,
        GameAction.sideshowReject,
        config.spGameplay.sideshowTimeout,
      );
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowResponse}`, {
        tableId,
        userId,
        action: GameLog.sideshowResponse,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      leaveLogs('sideshowRes exception unlock', { tableId, pid });
      this.redisService.releaseLock(tableId, pid);
      this.commonService.unlockUser(userId);
    }
  }

  async joinExistingTable(table: Table, user: PlayerGameInfo) {
    const socketId = (await this.transientDBService.getUserSocketId(
      user.userId,
    )) as SocketID;
    this.wss.in(socketId).socketsJoin(table.tableId);

    const { playerId } = table.players.find(
      (player) => player.userId === user.userId,
    ) as PlayerGameInfo;

    if (!playerId) {
      throw new BadRequestException('Table is full');
    }
    const { walletBalance, ...joinResponse } = user;

    this.wss
      .to(table.tableId)
      .except(socketId)
      .emit('playerJoined', {
        ...joinResponse,
        amount: this.commonService.getSubWalletSum(user.amount),
      });

    const tableData = this.tableService.handleTableResponse(table, user.userId);
    this.wss.to(socketId).emit('joinTableRes', {
      ...tableData,
      serverTime: dayjs().toISOString(),
    });

    // leave logs
    leaveLogs(`Gameplay log ${table.tableId} ${GameLog.joinTableResponse}`, {
      tableId: table.tableId,
      userId: user.userId,
      playerId,
      action: GameLog.joinTableResponse,
      type: LogType.response,
      payload: {
        tableData,
        table,
      },
    });
  }

  async revealCards(tableId: string) {
    leaveLogs('revealCards create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('revealCards lock', { tableId, pid });
    if (!table.commonCard || !table.hidden) {
      leaveLogs('Cards not dealt', { table });
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('revealCards unlock', { tableId: table.tableId, pid });
      return;
    }
    try {
      table.hidden = false;
      table.chaalAmount = Big(table.chaalAmount as string)
        .mul(2)
        .toString();
      table.players.map(async (player) => {
        const playerSeen = player.seen;
        if (player.active && !player.allin) {
          player.seen = true;
          player.chaalAfterSeen = false;
        }
        const socketId = (await this.transientDBService.getUserSocketId(
          player.userId,
        )) as string;
        // for the newly joined user
        if (!player.firstCard) {
          this.wss.to(socketId).emit('revealCards', {
            commonCard: table.commonCard,
            chaalAmount: table.chaalAmount,
          });
          return;
        }
        const playerCardsInfo = this.commonService.getPlayerCardsInfo([
          player.firstCard as Card,
          ...(player.hiddenCards as [Card, Card]),
          table.commonCard as Card,
        ]);
        if (!playerSeen) {
          this.wss.to(socketId).emit('seeCardRes', {
            hiddenCards: player.hiddenCards,
          });
        }
        this.wss.to(socketId)?.emit('revealCards', {
          playerCardsInfo,
          commonCard: table.commonCard,
          chaalAmount: table.chaalAmount,
        });
      });

      await this.tableService.updateTable(table, pid);
      leaveLogs('revealCards unlock', { tableId: table.tableId, pid });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.revealCards}`, {
        tableId,
        action: GameLog.revealCards,
        type: LogType.response,
        payload: { table },
      });
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.revealCards}`, {
        tableId,
        action: GameLog.revealCards,
        type: LogType.exception,
        payload: {
          error,
        },
      });
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('revealCards final unlock', {
        tableId: table.tableId,
        pid,
      });
    }
  }

  async gameEnded(tableId: string) {
    leaveLogs('roundended create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('roundended lock', { tableId, pid });
    if (table.gameStatus === GameStatus.gameEnded) {
      leaveLogs('The game is ended', { tableId });
      await this.redisService.releaseLock(tableId, pid);
      return;
    }
    try {
      const response = this.commonService.gameEnd(table);

      // distribute pot amount to players
      response.winners.map((winner) => {
        const playerIndex = table.players.findIndex(
          (player) => player.playerId === winner,
        );
        const playerInfo = response.playersEndInfo.find(
          (player) => player.playerId === winner,
        );
        table.players[playerIndex].amount.winning = Big(
          table.players[playerIndex].amount.winning,
        )
          .plus(Big(playerInfo?.amount as string))
          .toString();
      });
      table.potAmount = '0';
      table.turnNo++;
      table.hidden = false;
      table.roundEndInfo = response;
      table.updated = dayjs().toISOString();
      delete table.timeout;

      // send rebuy request to users with insufficient wallet amount for initial bet
      const timeout = dayjs()
        .add(
          config.spGameplay.rebuyTimeout + config.spGameplay.rebuyDelay,
          'second',
        )
        .toISOString();
      table.players.map((player) => {
        const playerAmount = this.commonService.getSubWalletBalance(
          player.amount,
        );
        player.betAmount = '0';
        if (
          Big(playerAmount).lte(Big(table.tableType.initialBetAmount)) &&
          !player.rebuying
        ) {
          const playerBalance = {
            main: Big(player.amount.main)
              .plus(player.walletBalance.main)
              .toString(),
            winning: Big(player.amount.winning)
              .plus(player.walletBalance.winning)
              .toString(),
            bonus: Big(player.amount.bonus)
              .plus(player.walletBalance.bonus)
              .toString(),
          };
          if (
            Big(this.commonService.getSubWalletBalance(playerBalance)).gte(
              table.tableType.initialBetAmount,
            )
          ) {
            player.rebuying = true;
            table.rebuyTimeout = timeout;
            this.spQueueService.addTimeoutAction(
              table.tableId,
              GameAction.rebuy,
              config.spGameplay.rebuyDelay,
              {
                userId: player.userId,
                amount: player.amount,
                walletBalance: this.commonService.getSubWalletBalance(
                  player.walletBalance,
                ),
              },
            );
          } else {
            this.spQueueService.addTimeoutAction(
              table.tableId,
              GameAction.rebuyBalanceLeave,
              config.spGameplay.rebuyDelay,
              player.userId,
            );
          }
        }
      });
      if (table.players.length < 2) {
        table.gameStatus = GameStatus.gameEnded;
      }
      await this.tableService.updateTable(table, pid);
      leaveLogs('roundended unlock', { tableId: table.tableId, pid });

      const { commissionAmount, ...roundEndedResponse } = response;
      this.wss.to(table.tableId).emit('roundEnded', {
        ...roundEndedResponse,
        potAmount: table.potAmount,
        commonCard: table.commonCard,
      });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.roundEnded}`, {
        tableId,
        action: GameLog.roundEnded,
        type: LogType.response,
        payload: {
          response,
          table,
        },
      });

      // check maintenance
      const underMaintenance = this.remoteConfigService.getSpMaintenance();
      if (underMaintenance && !table.isMaintenanceBypass) {
        leaveLogs('maintenance leave', { table });
        this.wss.to(tableId).emit('maintenance', { status: true });
        table.players.map((player) => {
          this.commonService.createLeftUserTableHistory(table, player.userId);
          this.commonService.createLeftUserRoundHistory(table, player.userId);
        });
        await this.redisService.releaseLock(tableId);
        await this.tableService.removeTable(table);
        await this.handleLeaveUser(table.tableType, table.players.length);
        leaveLogs(`Gameplay log ${tableId} ${GameLog.maintenance}`, {
          tableId: table.tableId,
          action: GameLog.maintenance,
          type: LogType.exception,
        });
        return;
      }

      if (table.players.length >= 2) {
        leaveLogs('roundEnded create 2', {
          tableId: table.tableId,
        });
        const { table: newTable, pid: newPid } =
          (await this.tableService.getTableOrThrowException(
            table.tableId,
          )) as TableWithPid;
        leaveLogs('roundEnded lock 2', {
          tableId: table.tableId,
          newPid,
        });
        const timeout = dayjs()
          .add(config.spGameplay.decideWinnerTimeout, 'second')
          .toISOString();
        table.timeout = timeout;
        await this.tableService.updateTable(newTable, newPid);
        leaveLogs('roundEnded unlock 2', {
          tableId: table.tableId,
          newPid,
        });

        this.spQueueService.addTimeoutAction(
          table.tableId,
          GameAction.startRound,
          config.spGameplay.decideWinnerTimeout,
        );
      } else {
        this.endGame(table.tableId);
      }
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.roundEnded}`, {
        tableId,
        action: GameLog.roundEnded,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      this.redisService.releaseLock(tableId, pid);
    }
  }

  async endGame(tableId: string) {
    leaveLogs('endGame create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('endGame lock', { tableId, pid });
    const timeout = dayjs()
      .add(config.spGameplay.gameEndDelay, 'second')
      .toISOString();
    table.timeout = timeout;
    table.gameStatus = GameStatus.gameEnded;
    await this.tableService.updateTable(table, pid);
    leaveLogs('endGame unlock', { tableId: table.tableId, pid });
    this.spQueueService.addTimeoutAction(
      table.tableId,
      GameAction.endGame,
      config.spGameplay.gameEndDelay,
    );
  }

  async endTable(tableId: string) {
    leaveLogs('endTable create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('endTable lock', { tableId, pid });
    try {
      // add money to the player, leave record, destroy table
      if (table.players.length > 1) {
        leaveLogs('Unable to finish the table, more than 1 player exists', {
          tableId,
        });
        await this.redisService.releaseLock(tableId, pid);
        leaveLogs('endTable unlock', { tableId, pid });
        await this.startRound(tableId);
        return;
      }
      const gameCommission =
        this.remoteConfigService.getSpCommissionsByUsers()[
          `${table.roundStartPlayersNo}`
        ] ?? '10';
      const winningAmount =
        table.players[0].active || table.players[0].allin
          ? Big(table.potAmount).mul(Big(100).sub(gameCommission)).div(100)
          : '0';
      this.wss.to(table.tableId).emit('gameEnd', {
        winner: table.players[0].playerId,
        amount: Big(this.commonService.getSubWalletSum(table.players[0].amount))
          .plus(winningAmount)
          .toString(),
      });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.gameEnded}`, {
        tableId,
        action: GameLog.gameEnded,
        type: LogType.response,
        payload: {
          winner: table.players[0].playerId,
          amount: Big(
            this.commonService.getSubWalletSum(table.players[0].amount),
          )
            .plus(
              Big(table.potAmount).mul(Big(100).sub(gameCommission)).div(100),
            )
            .toString(),
          table,
        },
      });

      this.redisService.releaseLock(tableId);
      this.tableService.removeTable(table);
      this.commonService.addWinningAmount(table);
      // for online user count
      this.handleLeaveUser(table.tableType, 1);
    } catch (error) {
      throw error;
    } finally {
      leaveLogs('endTable exception unlock', { table });
      this.redisService.releaseLock(tableId, pid);
    }
  }

  async destroyInactiveTable(tableId: string) {
    // reward last amounts
    const table = (await this.tableService.getTable(tableId)) as Table;
    if (!table) {
      throw new BadRequestException('Inactive Table to destroy does not exist');
    }
    const userIds = table.players.map((player) => player.userId);
    const amounts = table.players.map((player) => {
      player.amount.main = Big(player.amount.main)
        .plus(player.betAmount)
        .toString();
      return player.amount;
    });

    await this.commonService.refundStuckTable(userIds, amounts, tableId);

    this.handleLeaveUser(table.tableType, table.players.length);
    table.players.map(async (player) => {
      const socketId = (await this.transientDBService.getUserSocketId(
        player.userId as UserID,
      )) as SocketID;
      this.wss
        .to(socketId)
        .emit('playerLeftTable', { playerId: player.playerId });
      this.commonService.createLeftUserTableHistory(table, player.userId, true);
    });
    await this.redisService.releaseLock(tableId);
    this.tableService.removeTable(table);

    // clear queue if it is locked
    const queueName = table.tableType.tableTypeId;
    this.clearQueue(queueName);

    leaveLogs(`Gameplay log ${table.tableId} ${GameLog.destroyInactiveTable}`, {
      tableId: table.tableId,
      action: GameLog.destroyInactiveTable,
      type: LogType.exception,
    });
  }

  async chaalBet(table: Table, userId: UserID, pid: string) {
    try {
      const currentPlayerIndex = table.players.findIndex(
        (player) => player.userId === userId,
      );
      const player = table.players[currentPlayerIndex];

      if (!player.active) {
        throw new BadRequestException(
          'Inactive player should not able to play',
        );
      }
      if (!player || currentPlayerIndex === -1) {
        throw new BadRequestException('Player not found');
      }
      if (
        table.gameStatus !== GameStatus.playing &&
        table.gameStatus !== GameStatus.sideshow &&
        table.gameStatus !== GameStatus.showdown
      ) {
        throw new BadRequestException('The table is not in playing status');
      }

      if (player.playerId !== table.currentTurn) {
        throw new BadRequestException("Not the player's turn");
      }
      let chaalAmount =
        player.seen && table.hidden
          ? Big(table.chaalAmount as string)
              .mul(2)
              .toString()
          : (table.chaalAmount as string);
      const limitAmount = Big(table.tableType.potLimit)
        .minus(Big(table.potAmount))
        .toString();
      chaalAmount = Big(chaalAmount).gt(Big(limitAmount))
        ? limitAmount.toString()
        : chaalAmount;

      const playerBalance = this.commonService.getSubWalletBalance(
        player.amount,
      );
      if (Big(chaalAmount).gte(playerBalance)) {
        throw new BadRequestException('Not enough balance for chaal');
      }

      if (Big(chaalAmount).lt(Big('0'))) {
        throw new BadRequestException('Chaal Amount less than 0');
      }

      table.players[currentPlayerIndex].betAmount = Big(
        player.betAmount as string,
      )
        .plus(Big(chaalAmount))
        .toString();
      table.players[currentPlayerIndex].lastBetAmount = table.chaalAmount;
      table.players[currentPlayerIndex].amount =
        this.commonService.debitSubWallet(player.amount, chaalAmount);
      table.potAmount = Big(table.potAmount as string)
        .plus(Big(chaalAmount))
        .toString();
      table.turnNo++;
      table.skipTurnNo = 0;
      // decide if there is winner
      const activePlayers = this.tableService.getActivePlayers(table);
      const lastBetAmount = activePlayers[0].lastBetAmount;
      const tableChaalAmount = table.chaalAmount;
      if (
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(tableChaalAmount))) ||
        Big(table.potAmount).gte(Big(table.tableType.potLimit))
      ) {
        table.gameStatus = GameStatus.roundEnded;
      }

      await this.tableService.updateTable(table, pid);
      // leaveLogs('chaalBet unlock', { tableId: table.tableId, pid });

      // leave logs
      leaveLogs(`Gameplay log ${table.tableId} ${GameLog.chaal}`, {
        tableId: table.tableId,
        userId,
        action: GameLog.chaal,
        type: LogType.response,
        payload: {
          playerId: player.playerId,
          amount: chaalAmount,
          playerAmount: this.commonService.getSubWalletSum(
            table.players[currentPlayerIndex].amount,
          ),
          potAmount: table.potAmount,
          chaalAmount: table.chaalAmount,
          table,
        },
      });
      this.wss.to(table.tableId).emit('playerChaal', {
        playerId: player.playerId,
        amount: chaalAmount,
        playerAmount: this.commonService.getSubWalletSum(
          table.players[currentPlayerIndex].amount,
        ),
        potAmount: table.potAmount,
        chaalAmount: table.chaalAmount,
      });
    } catch (error) {
      throw error;
    } finally {
      await this.redisService.releaseLock(table.tableId, pid);
    }
  }

  async next(tableId: string, isSideshow?: boolean) {
    // decide if there is winner
    leaveLogs('next create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('next lock', { tableId, pid });
    try {
      if (
        table.gameStatus === GameStatus.roundEnded ||
        table.gameStatus === GameStatus.gameEnded
      ) {
        leaveLogs('next game status', { gameStatus: table.gameStatus });
        await this.redisService.releaseLock(tableId, pid);
        leaveLogs('next unlock', { tableId, pid });
        return;
      }
      const activePlayers = this.tableService.getActivePlayers(table);
      const lastBetAmount =
        activePlayers.length > 0 ? activePlayers[0].lastBetAmount : '0';
      if (
        activePlayers.length === 0 ||
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(table.chaalAmount))) ||
        Big(table.potAmount).gte(Big(table.tableType.potLimit))
      ) {
        await this.redisService.releaseLock(tableId, pid);
        this.roundEnd(table.tableId);
        return;
      }

      const currentPlayerIndex = this.tableService.getCurrentPlayerIndex(table);
      const nextPlayer = isSideshow
        ? table.players[currentPlayerIndex]
        : this.tableService.getNextActivePlayer(table);
      const nextTurn = nextPlayer.playerId;
      table.currentTurn = nextTurn;
      table.turnNo++;
      delete table.sideshowAccepted;
      table.gameStatus = GameStatus.playing;
      const timeout = dayjs()
        .add(config.spGameplay.turnTimeout, 'second')
        .toISOString();
      table.timeout = timeout;
      table.updated = dayjs().toISOString();
      await this.tableService.updateTable(table, pid);
      leaveLogs('next unlock', { tableId: table.tableId, pid });

      this.wss.to(table.tableId).emit('turnTimeout', {
        playerId: table.currentTurn,
        timeout,
        playerAmount: this.commonService.getSubWalletBalance(nextPlayer.amount),
        chaalAfterSeen: nextPlayer.seen && table.hidden,
        chaalAmount: table.chaalAmount,
        potAmount: table.potAmount,
        gameStatus: table.gameStatus,
        limitAmount: Big(table.tableType.potLimit)
          .minus(Big(table.potAmount))
          .toString(),
      });
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.turnTimeout}`, {
        tableId,
        action: GameLog.turnTimeout,
        type: LogType.response,
        playerId: table.currentTurn,
        payload: {
          timeout,
          playerAmount: this.commonService.getSubWalletBalance(
            nextPlayer.amount,
          ),
          chaalAfterSeen: nextPlayer.seen && table.hidden,
          chaalAmount: table.chaalAmount,
          potAmount: table.potAmount,
          gameStatus: table.gameStatus,
          limitAmount: Big(table.tableType.potLimit)
            .minus(Big(table.potAmount))
            .toString(),
          table,
        },
      });

      this.spQueueService.addTimeoutAction(
        table.tableId,
        GameAction.skipTurn,
        config.spGameplay.turnTimeout,
        {
          turnNo: table.turnNo,
          roundNo: table.roundNo,
        },
      );
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.turnTimeout}`, {
        tableId,
        action: GameLog.turnTimeout,
        type: LogType.exception,
        payload: {
          error,
        },
      });
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      // leaveLogs('next unlock', { tableId, pid });
    }
  }

  async roundEnd(tableId: string) {
    leaveLogs('roundEnd create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('roundEnd lock', { tableId, pid });
    this.commonService.createRoundHistory(table);
    if (table.gameStatus === GameStatus.gameEnded) {
      leaveLogs('gameEnd status', { tableId: table.tableId, pid });
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('roundEnd unlock', { tableId: table.tableId, pid });
      return;
    }
    try {
      const timeout = dayjs()
        .add(config.spGameplay.roundEndDelay, 'second')
        .toISOString();
      table.timeout = timeout;
      table.gameStatus = GameStatus.roundEnded;
      await this.tableService.updateTable(table, pid);
      // leaveLogs('roundEnd unlock', { tableId: table.tableId, pid });

      if (table.hidden) {
        await this.revealCards(tableId);
      }
      this.spQueueService.addTimeoutAction(
        table.tableId,
        GameAction.roundEnded,
        config.spGameplay.roundEndDelay,
      );
    } catch (error) {
      leaveLogs('roundEnd error', error);
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      // leaveLogs('roundEnd exception unlock', { tableId, pid });
    }
  }

  async leaveTable(tableId: TableID, userId: UserID, isManual?: boolean) {
    leaveLogs('leaveTable create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('leaveTable lock', { tableId, pid });

    try {
      const playerId = table.players.find(
        (player) => player.userId === userId,
      )?.playerId;
      if (!playerId) {
        await this.redisService.releaseLock(tableId, pid);
        throw new BadRequestException('userId not exist on table');
      }

      if (table.players.length <= 1) {
        await this.redisService.releaseLock(tableId, pid);
        leaveLogs('leaveTable oneplayer', { tableId });
        throw new BadRequestException('leaveTable oneplayer');
      }
      this.wss.to(tableId).emit('playerLeftTable', { playerId });

      if (table.gameStatus === GameStatus.sideshow && isManual) {
        const previousPlayerIndex = this.tableService.getPrevPlayerIndex(table);
        const previousPlayer = table.players[previousPlayerIndex];
        const timeout = dayjs()
          .add(config.spGameplay.sideshowTimeout, 'second')
          .toISOString();
        table.timeout = timeout;

        if (previousPlayer.playerId === playerId) {
          this.wss.to(tableId).emit('sideshowRejected', {
            startPlayerId: table.currentTurn,
            receivePlayerId: previousPlayer.playerId,
            timeout,
          });
          table.sideshowAccepted = false;
          table.turnNo++;
          table.gameStatus = GameStatus.playing;

          // remove player from the table
          await this.tableService.leaveTable(
            table,
            userId,
            pid,
            isManual,
            true,
          );

          // leave logs
          leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowRejected}`, {
            tableId,
            userId,
            playerId,
            action: GameLog.sideshowRejected,
            type: LogType.response,
            payload: {
              startPlayerId: table.currentTurn,
              receivePlayerId: previousPlayer.playerId,
              timeout,
              table,
            },
          });

          this.spQueueService.addTimeoutAction(
            tableId,
            GameAction.sideshowReject,
            config.spGameplay.sideshowTimeout,
          );
        } else if (table.currentTurn === playerId) {
          const socketId = (await this.transientDBService.getUserSocketId(
            previousPlayer.userId,
          )) as SocketID;
          this.wss.to(socketId).emit('sideshowResult', {
            winner: previousPlayer.playerId,
            startPlayerId: table.currentTurn,
            receivePlayerId: previousPlayer.playerId,
            timeout,
          });

          this.wss.to(tableId).except(socketId).emit('sideshowAccepted', {
            winner: previousPlayer.playerId,
            startPlayerId: table.currentTurn,
            receivePlayerId: previousPlayer.playerId,
            timeout,
          });

          // leave logs
          leaveLogs(`Gameplay log ${tableId} ${GameLog.sideshowAccepted}`, {
            tableId,
            userId,
            playerId,
            action: GameLog.sideshowAccepted,
            type: LogType.response,
            payload: {
              winner: previousPlayer.playerId,
              startPlayerId: table.currentTurn,
              receivePlayerId: previousPlayer.playerId,
              timeout,
              table,
            },
          });

          table.sideshowAccepted = true;
          table.gameStatus = GameStatus.playing;
          table.turnNo++;
          // remove player from the table
          await this.tableService.leaveTable(table, userId, pid, true, true);

          this.spQueueService.addTimeoutAction(
            tableId,
            GameAction.next,
            config.spGameplay.sideshowTimeout,
            {
              turnNo: table.turnNo,
              roundNo: table.roundNo,
              isSideshow: true,
            },
          );
        } else {
          // remove player from the table
          await this.tableService.leaveTable(table, userId, pid, isManual);
        }
      } else {
        // remove player from the table
        await this.tableService.leaveTable(table, userId, pid, isManual);
      }

      // reveal cards
      const activePlayers = this.tableService.getActivePlayers(table);
      if (activePlayers.every((player) => player.seen) && table.hidden) {
        await this.revealCards(table.tableId);
      }

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.playerLeftTable}`, {
        tableId,
        userId,
        playerId,
        action: GameLog.playerLeftTable,
        type: LogType.response,
        payload: {
          playerId,
          table,
        },
      });

      const socketId = (await this.transientDBService.getUserSocketId(
        userId,
      )) as SocketID;

      // for online user count
      this.handleLeaveUser(table.tableType, 1);

      this.wss.in(socketId).socketsLeave(tableId);
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.leaveTable}`, {
        tableId,
        userId,
        action: GameLog.leaveTable,
        type: LogType.exception,
        payload: {
          error,
        },
      });
      throw error;
    } finally {
      leaveLogs('leaveTable final unlock', { tableId, pid });
      this.redisService.releaseLock(tableId, pid);
    }
  }

  async pack(tableId: string, userId?: UserID) {
    leaveLogs('pack2 create', { tableId });
    const { table, pid } = (await this.tableService.getTableOrThrowException(
      tableId,
    )) as TableWithPid;
    leaveLogs('pack2 lock', { tableId, pid });
    try {
      const playerIndex = table.players.findIndex((player) =>
        userId
          ? player.userId === userId
          : player.playerId === table.currentTurn,
      );
      if (
        playerIndex === -1 ||
        (!table.players[playerIndex].active &&
          !table.players[playerIndex].firstCard)
      ) {
        leaveLogs('player to pack not found', { userId, table });
        await this.redisService.releaseLock(tableId, pid);
        if (userId) {
          this.next(table.tableId, true);
        }
        return;
      }

      table.players[playerIndex].active = false;
      table.turnNo++;
      table.gameStatus = GameStatus.playing;
      // decide if there is winner
      const activePlayers = this.tableService.getActivePlayers(table);
      const allinPlayers = this.tableService.getAllinPlayers(table);
      const lastBetAmount =
        activePlayers.length > 0 ? activePlayers[0].lastBetAmount : '0';
      const tableChaalAmount = table.chaalAmount;
      if (
        activePlayers.length === 0 ||
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(tableChaalAmount))) ||
        allinPlayers.length + activePlayers.length <= 1
      ) {
        table.gameStatus = GameStatus.roundEnded;
      }
      await this.tableService.updateTable(table, pid);
      leaveLogs('pack2 unlock', { tableId: table.tableId, pid });

      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.pack}`, {
        tableId: table.tableId,
        userId,
        playerId: table.players[playerIndex].playerId,
        type: LogType.response,
        action: GameLog.pack,
        payload: { playerId: table.players[playerIndex].playerId, table },
      });
      this.wss
        .to(table.tableId)
        .emit('playerPack', { playerId: table.players[playerIndex].playerId });

      // decide if there is winner
      if (
        activePlayers.length === 0 ||
        (activePlayers.length === 1 &&
          Big(lastBetAmount).gte(Big(tableChaalAmount))) ||
        allinPlayers.length + activePlayers.length <= 1
      ) {
        this.roundEnd(tableId);
        return;
      }

      // reveal cards
      if (activePlayers.every((player) => player.seen) && table.hidden) {
        await this.revealCards(tableId);
        this.spQueueService.addTimeoutAction(
          table.tableId,
          GameAction.next,
          config.spGameplay.revealCardDelay,
          {
            turnNo: table.turnNo,
            roundNo: table.roundNo,
          },
        );
      } else {
        await this.next(tableId, !!userId);
      }
    } catch (error) {
      // leave logs
      leaveLogs(`Gameplay log ${tableId} ${GameLog.pack}`, {
        tableId,
        userId,
        action: GameLog.pack,
        type: LogType.exception,
        payload: {
          error,
        },
      });
    } finally {
      await this.redisService.releaseLock(tableId, pid);
      leaveLogs('pack2 unlock', { tableId, pid });
    }
  }

  async sendRebuyRequest(
    table: Table,
    userId: UserID,
    currentAmount: SubWallet,
    walletBalance: string,
  ) {
    const socketId = (await this.transientDBService.getUserSocketId(
      userId,
    )) as SocketID;

    const player = this.tableService.getPlayerFromUserId(table, userId);
    if (!player) {
      leaveLogs('No player with the user id', { tableId: table.tableId });
      return;
    }

    this.wss.to(socketId).emit('rebuyReq', {
      playerId: player.playerId,
      currentAmount: this.commonService.getSubWalletSum(currentAmount),
      walletBalance,
      timeout: table.rebuyTimeout,
    });

    this.wss.to(table.tableId).except(socketId).emit('rebuyReq', {
      playerId: player.playerId,
      timeout: table.rebuyTimeout,
    });

    // leave logs
    leaveLogs(`Gameplay log ${table.tableId} ${GameLog.rebuyRequest}`, {
      tableId: table.tableId,
      userId,
      playerId: player.playerId,
      action: GameLog.rebuyRequest,
      type: LogType.response,
      payload: {
        currentAmount: this.commonService.getSubWalletSum(currentAmount),
        walletBalance,
        timeout: table.rebuyTimeout,
        table,
      },
    });

    this.spQueueService.addTimeoutAction(
      table.tableId,
      GameAction.rebuyTimeoutLeave,
      config.spGameplay.rebuyTimeout,
      { userId },
    );
  }

  async joinTable(userIds: UserID[], tableId: TableID) {
    Promise.all([
      userIds.map(async (userId) => {
        const socketId = (await this.transientDBService.getUserSocketId(
          userId,
        )) as SocketID;
        this.wss.in(socketId).socketsJoin(tableId);
      }),
    ]);
  }

  async leftWaitingTable(userId: UserID, status: boolean) {
    leaveLogs('leave waiting table', { userId });
    const socketId = (await this.transientDBService.getUserSocketId(
      userId,
    )) as SocketID;
    // await this.transientDBService.deleteUserActiveTableId(userId);
    this.wss.to(socketId).emit('leaveWaitingTableRes', { status });

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

  async clearQueue(queueName: string) {
    if (await this.transientDBService.getQueueLock(queueName)) {
      await this.transientDBService.setQueueLock(queueName, false);
      const userIds = await this.redisService.getKeys(queueName);
      await Promise.all(
        userIds.map((userId) => {
          this.spGameplayController.leaveWaitingTable(userId);
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
    const tables = this.remoteConfigService.getSpTableInfos();
    const tablesTypes: any = [];
    for (const table of tables) {
      const userNo: string = (await this.transientDBService.getUserCount(
        table.tableTypeId,
      )) as string;
      tablesTypes.push({ ...table, userCount: userNo });
    }
    client.emit('allUserCount', { tables: tablesTypes });
  }

  /**
   * This is for counting online users in Join Case
   */
  async handleJoinUser(tableType: TableType, number_: number) {
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
  async handleLeaveUser(tableType: TableType, number_: number) {
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
