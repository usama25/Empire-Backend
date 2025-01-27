/* eslint-disable @typescript-eslint/no-unused-vars */

import { Server, Socket } from 'socket.io';
import * as dayjs from 'dayjs';
import { EPLGameMaintenanceGuard } from '../../guards/maintenance-guard';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { verifyJwtTokenInSocketIo } from '@lib/fabzen-common/utils/jwt.util';
import {
  WsClient,
  WsData,
  WsSubscribeMessage,
  WsUserID,
} from '@lib/fabzen-common/decorators';
import { UserGameDetails, UserID } from '@lib/fabzen-common/types/user.types';
import {
  BatBowlRequest,
  JoinTableRequest,
} from '../../domain/entities/types.dto';
import { EPLGameplayUseCases } from '../../domain/use-cases/gameplay.usecases';
import { AuthenticatedSocket } from '@lib/fabzen-common/types/socket.types';
import { OnEvent } from '@nestjs/event-emitter';
import { PlayerId } from 'aws-sdk/clients/gamelift';
import {
  InningStartEvent,
  LeaveWaitingTableEvent,
  LeftTableEvent,
  TurnResultEvent,
  TurnTimeoutEvent,
} from '../../domain/use-cases/types';
import { ExtendedSocket } from '@lib/fabzen-common/types';
import {
  LeaveTableRequest,
  leaveWaitingTableRequest,
} from 'apps/sl-gameplay/src/domain/entities';

@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class EPLGameplayGateway implements OnGatewayConnection {
  @WebSocketServer() wss: Server;
  private readonly logger = new Logger(EPLGameplayGateway.name);

  constructor(private readonly eplGameplayUseCases: EPLGameplayUseCases) {}

  async handleConnection(client: Socket) {
    this.#authenticateSocket(client);
    this.#forceDisconnectSameUsers(client as AuthenticatedSocket);
    this.#sendServerTime(client);
    this.#sendReconnectionData(client as AuthenticatedSocket);
  }

  async #sendReconnectionData(client: AuthenticatedSocket) {
    const { userId } = client.user;
    const reconnectionData = {
      isReconnected: false,
    };
    client.emit('reconnectGame', reconnectionData);
  }

  #forceDisconnectSameUsers(client: AuthenticatedSocket) {
    const { user, id: socketId } = client;
    const userId = user.userId;
    client.join(userId);
    this.wss.to(userId).except(socketId).emit('forceLogout', {
      cause: 'Logged in from other device',
    });
    this.wss.in(userId).except(socketId).disconnectSockets(true);
  }

  #authenticateSocket(client: Socket) {
    try {
      verifyJwtTokenInSocketIo(client);
    } catch {
      client.disconnect(true);
      return;
    }
  }

  #sendServerTime(client: Socket) {
    client.emit('serverTime', { time: dayjs().toISOString() });
  }

  async broadcastOnlineUserCount() {
    const count = await this.getOnlineUserCount();
    this.wss.emit('onlineUserCountRes', { count });
  }

  async getOnlineUserCount() {
    const sockets = await this.wss.fetchSockets();
    const count = sockets ? sockets.length : 0;
    return count;
  }

  @UseGuards(EPLGameMaintenanceGuard)
  @WsSubscribeMessage('joinTable')
  async onJoinTableEvent(
    @WsUserID() userId: UserID,
    @WsData(JoinTableRequest) { tableTypeId }: JoinTableRequest,
  ) {
    this.wss.in(userId).socketsJoin(tableTypeId);
    const { waitingUsers, timeout } =
      await this.eplGameplayUseCases.handleJoinTableRequest(
        userId,
        tableTypeId,
      );
    const myUser = waitingUsers.find(
      (waitingUser) => waitingUser.userDetails.userId === userId,
    );
    if (!myUser) {
      throw new InternalServerErrorException(
        `User ${userId} not found on the queue`,
      );
    }

    const players: { playerId: string; playerInfo: UserGameDetails }[] = [];

    let index = 0;
    for (const user of waitingUsers) {
      const { userDetails } = user;
      const playerId = `PL${index + 1}`;
      players.push({
        playerId,
        playerInfo: userDetails,
      });
      index++;
    }

    // Last one is the new player
    const newPlayer = players.at(-1);

    for (const player of players) {
      if (player.playerInfo.userId === userId) {
        this.wss.in(userId).emit('joinTableRes', {
          myPlayerId: player.playerId,
          matchingTimeout: timeout,
          players,
        });
      } else {
        this.wss.in(player.playerInfo.userId).emit('playerJoined', newPlayer);
      }
    }
  }

  public getPlayerIdNumber(playerId: PlayerId) {
    return Number.parseInt(playerId.replace('PL', ''), 10);
  }

  @WsSubscribeMessage('bat')
  async onBatEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(BatBowlRequest) { tableId, runs }: BatBowlRequest,
  ) {
    console.log('bat event', userId, runs, tableId);
    this.wss.in(userId).socketsJoin(tableId);
    await this.eplGameplayUseCases.handleBatBowlRequest(
      tableId,
      runs,
      userId,
      'batsman',
    );
  }

  @WsSubscribeMessage('bowl')
  async onBowlEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(BatBowlRequest) { tableId, runs }: BatBowlRequest,
  ) {
    console.log('bat event', userId, runs, tableId);
    this.wss.in(userId).socketsJoin(tableId);
    await this.eplGameplayUseCases.handleBatBowlRequest(
      tableId,
      runs,
      userId,
      'bowler',
    );
  }

  @OnEvent('socketEvent.matchingTimeout')
  handlematchingTimeoutEvent(userIds: string[]) {
    this.emitMatchingTimeoutEvent(userIds);
  }

  @OnEvent('socketEvent.inningStarted')
  handleStartGameEvent(inningStartedResponse: InningStartEvent[]) {
    this.emitStartGameEvent(inningStartedResponse);
  }

  public emitStartGameEvent(inningStartedResponse: InningStartEvent[]) {
    for (const data of inningStartedResponse) {
      this.wss.to(data.userId).emit('inningStarted', data.response);
    }
  }

  @OnEvent('socketEvent.turnTimeout')
  handleTurnTimeoutEvent(turnTimeout: TurnTimeoutEvent[]) {
    this.emitTurnTimeoutEvent(turnTimeout);
  }

  public emitTurnTimeoutEvent(turnTimeout: TurnTimeoutEvent[]) {
    for (const data of turnTimeout) {
      const { playerRole, timeout, userId, tableId } = data;
      this.wss.to(userId).emit('turnTimeout', { playerRole, tableId, timeout });
    }
  }

  @OnEvent('socketEvent.turnResult')
  handleTurnResultEvent(turnTimeoutResponse: TurnResultEvent[]) {
    console.log('TURN RESULT RESPONSE', turnTimeoutResponse);
    this.emitTurnResultEvent(turnTimeoutResponse);
  }

  public emitTurnResultEvent(turnTimeoutResponse: TurnResultEvent[]) {
    for (const data of turnTimeoutResponse) {
      this.wss.to(data.userId).emit('turnResult', data);
    }
  }

  public emitMatchingTimeoutEvent(userIds: string[]) {
    this.logger.log(`Game Play log matchingTimeout ${userIds}`);
    this.wss.in(userIds).emit('matchingTimeout', {});
  }

  @OnEvent('socketEvent.gameEnded')
  handleGameEndedEvent(gameEndResponse: any) {
    this.emitGameEndedEvent(gameEndResponse);
  }

  public emitGameEndedEvent(gameEndResponse: any) {
    for (const player of gameEndResponse.players) {
      this.wss.to(player.userId).emit('gameEnd', gameEndResponse);
    }
  }

  @OnEvent('socketEvent.leaveWaitingTable')
  handleLeftWaitingTableEvent(
    leftWaitingTableResponse: LeaveWaitingTableEvent,
  ) {
    console.log(
      `Handling leaveWaitingTable event: ${JSON.stringify(
        leftWaitingTableResponse,
      )}`,
    );
    this.emitLeaveWaitingTableEvent(leftWaitingTableResponse);
    console.log(
      `Emitted leaveWaitingTable event: ${JSON.stringify(
        leftWaitingTableResponse,
      )}`,
    );
  }

  @WsSubscribeMessage('leaveWaitingTable')
  async onLeaveWaitingEvent(
    @WsUserID() userId: UserID,
    @WsData(leaveWaitingTableRequest) { tableTypeId }: leaveWaitingTableRequest,
  ) {
    console.log(
      `Received leaveWaitingTable request for userId: ${userId}, tableTypeId: ${tableTypeId}`,
    );

    await this.eplGameplayUseCases.leaveWaitingTable(userId, tableTypeId);
    console.log(
      `Finished processing leaveWaitingTable for userId: ${userId}, tableTypeId: ${tableTypeId}`,
    );

    this.wss.in(userId).socketsLeave(tableTypeId);
    console.log(`User ${userId} left the room ${tableTypeId}`);
  }

  public emitLeaveWaitingTableEvent({
    userId,
    leaveWaitingTableResponse,
  }: LeaveWaitingTableEvent) {
    console.log(
      `Emitting leaveWaitingTable event to userId: ${userId}, response: ${JSON.stringify(
        leaveWaitingTableResponse,
      )}`,
    );

    this.wss.to(userId).emit('leaveWaitingTableRes', leaveWaitingTableResponse);
    console.log(`Emitted leaveWaitingTableRes event to userId: ${userId}`);
  }

  @WsSubscribeMessage('leaveTable')
  async onLeaveTableEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(LeaveTableRequest) { tableId }: LeaveTableRequest,
  ) {
    await this.eplGameplayUseCases.handleLeaveTable(tableId, userId);
  }

  @OnEvent('socketEvent.leaveTable')
  handleLeftTableEvent(leftTableResponse: LeftTableEvent[]) {
    this.emitLeaveTableEvent(leftTableResponse);
  }

  public emitLeaveTableEvent(leftTableResponse: LeftTableEvent[]) {
    for (const data of leftTableResponse) {
      this.wss.to(data.userId).emit('playerLeft', data.response);
    }
  }

  @WsSubscribeMessage('flushRedis')
  async onFlushRedisEvent() {
    console.log('Flushing Redis...');
    await this.eplGameplayUseCases.flushRedis();
    console.log('Redis flushed successfully.');
    this.wss.emit('flushRedis success', {});
  }
}
