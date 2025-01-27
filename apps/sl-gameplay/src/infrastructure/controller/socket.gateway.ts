import { Server, Socket } from 'socket.io';
import * as dayjs from 'dayjs';
import { OnEvent } from '@nestjs/event-emitter';
import {
  NextActionEvent,
  MovePawnEvent,
  LeftTableEvent,
  RollDiceEvent,
  StartGameEvent,
  TurnSkipEvent,
  LeaveWaitingTableEvent,
  EndGameResponse,
} from '../../domain/use-cases/types';
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
  ExtendedSocket,
  UserGameDetails,
  UserID,
} from '@lib/fabzen-common/types';
import {
  WsSubscribeMessage,
  WsUserID,
  WsData,
  WsClient,
} from '@lib/fabzen-common/decorators';
import {
  JoinTableRequest,
  leaveWaitingTableRequest,
  ReadyToStartRequest,
  RollDiceRequest,
  MovePawnRequest,
  LeaveTableRequest,
  SkipTurnRequest,
  EmojiData,
  MessageData,
} from '../../domain/entities/types.dto';
import { SLGameMaintenanceGuard } from '../gateways/maintenance-guard';
import { SLGameplayUseCases } from '../../domain/use-cases';
import { AuthenticatedSocket } from '@lib/fabzen-common/types/socket.types';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { PlayerId } from 'aws-sdk/clients/gamelift';

@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class SLGameplayGateway implements OnGatewayConnection {
  @WebSocketServer() wss!: Server;
  private readonly logger = new Logger(SLGameplayGateway.name);

  constructor(
    private readonly slGameplayUseCases: SLGameplayUseCases,
    private readonly configService: RemoteConfigService,
  ) {}

  async handleConnection(client: Socket) {
    this.#authenticateSocket(client);
    this.#forceDisconnectSameUsers(client as AuthenticatedSocket);
    this.#sendServerTime(client);
    this.#sendReconnectionData(client as AuthenticatedSocket);
  }

  #authenticateSocket(client: Socket) {
    try {
      verifyJwtTokenInSocketIo(client);
    } catch {
      client.disconnect(true);
      return;
    }
  }

  #forceDisconnectSameUsers(client: AuthenticatedSocket) {
    const { user, id: socketId } = client as AuthenticatedSocket;
    const userId = user.userId;
    client.join(userId);
    this.wss.to(userId).except(socketId).emit('forceLogout', {
      cause: 'Logged in from other device',
    });
    this.wss.in(userId).except(socketId).disconnectSockets(true);
  }

  async #sendReconnectionData(client: AuthenticatedSocket) {
    const { userId } = client.user;
    const reconnectionData =
      await this.slGameplayUseCases.getReconnectionData(userId);
    client.emit('reconnectGame', reconnectionData);
    const tableId = reconnectionData.tableInfo?.tableId;
    if (tableId) {
      client.join(tableId);
    }
  }

  #sendServerTime(client: Socket) {
    client.emit('serverTime', { time: dayjs().toISOString() });
  }

  @UseGuards(SLGameMaintenanceGuard)
  @WsSubscribeMessage('joinTable')
  async onJoinTableEvent(
    @WsUserID() userId: UserID,
    @WsData(JoinTableRequest) { tableTypeId }: JoinTableRequest,
  ) {
    this.wss.in(userId).socketsJoin(tableTypeId);
    const { waitingUsers, timeout } =
      await this.slGameplayUseCases.handleJoinTableRequest(userId, tableTypeId);
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

  @UseGuards(SLGameMaintenanceGuard)
  @WsSubscribeMessage('getUserCount')
  async getUserCount(client: ExtendedSocket) {
    const tableTypes = [];
    const gameTables = this.configService.getSLGameTables();
    for (const table of gameTables) {
      const clients: ExtendedSocket[] = (await this.wss
        .in(table.tableTypeId)
        .fetchSockets()) as ExtendedSocket[];
      const number = clients.length;
      const userCount = {
        tableTypeId: table.tableTypeId,
        userCount: number,
      };
      tableTypes.push(userCount);
    }
    client.emit('allUserCount', { tableTypes });
  }

  @WsSubscribeMessage('flushRedis')
  async onFlushRedisEvent() {
    await this.slGameplayUseCases.flushRedis();
    this.wss.emit('flushRedis success', {});
  }

  @WsSubscribeMessage('rollDice')
  async onRollDiceEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(ReadyToStartRequest) { tableId }: RollDiceRequest,
  ) {
    this.wss.in(userId).socketsJoin(tableId);
    await this.slGameplayUseCases.handleRollDice(userId, tableId);
  }

  @WsSubscribeMessage('movePawn')
  async onMovePawnEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(MovePawnRequest) movePawnRequest: MovePawnRequest,
  ) {
    await this.slGameplayUseCases.handleMovePawn(movePawnRequest);
  }

  @WsSubscribeMessage('leaveTable')
  async onLeaveTableEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(LeaveTableRequest) { tableId }: LeaveTableRequest,
  ) {
    await this.slGameplayUseCases.handleLeaveTable(tableId, userId);
  }

  @WsSubscribeMessage('skipTurn')
  async onSkipTurnEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(SkipTurnRequest) { tableId }: SkipTurnRequest,
  ) {
    await this.slGameplayUseCases.handleSkipTurn(tableId, userId);
  }

  @WsSubscribeMessage('leaveWaitingTable')
  async onLeaveWaitingEvent(
    @WsUserID() userId: UserID,
    @WsData(leaveWaitingTableRequest) { tableTypeId }: leaveWaitingTableRequest,
  ) {
    await this.slGameplayUseCases.leaveWaitingTable(userId, tableTypeId);
    this.wss.in(userId).socketsLeave(tableTypeId);
  }

  @WsSubscribeMessage('sendEmoji')
  async onSendEmojiEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(EmojiData) emojiData: EmojiData,
  ) {
    const tableId = this.getTableIdFromSocket(client);
    if (tableId) {
      this.wss.to(tableId).emit('deliverEmoji', emojiData);
    }
  }

  @WsSubscribeMessage('sendMessage')
  async onSendMessagEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(MessageData) messageData: MessageData,
  ) {
    const tableId = this.getTableIdFromSocket(client);
    if (tableId) {
      this.wss.to(tableId).emit('deliverMessage', messageData);
    }
  }

  private getTableIdFromSocket(client: ExtendedSocket): string | undefined {
    const rooms = this.getTableIdsFromSocket(client);
    return rooms[0];
  }

  private getTableIdsFromSocket(client: ExtendedSocket): string[] {
    return [...client.rooms].filter((tableId) => tableId.length === 12);
  }

  @OnEvent('socketEvent.leaveTable')
  handleLeftTableEvent(leftTableResponse: LeftTableEvent[]) {
    this.emitLeaveTableEvent(leftTableResponse);
  }

  @OnEvent('socketEvent.leaveWaitingTable')
  handleLeftWaitingTableEvent(
    leftWaitingTableResponse: LeaveWaitingTableEvent,
  ) {
    this.emitLeaveWaitingTableEvent(leftWaitingTableResponse);
  }

  @OnEvent('socketEvent.gameEndRes')
  handleEndGameEvent(endGameEvent: EndGameResponse[]) {
    this.emitGameFinishedEventAndLeave(endGameEvent);
  }

  @OnEvent('socketEvent.matchingTimeout')
  handlematchingTimeoutEvent(userIds: string[]) {
    this.emitMatchingTimeoutEvent(userIds);
  }

  @OnEvent('socketEvent.nextAction')
  handleNextActionEvent(nextAction: NextActionEvent) {
    this.logger.log(
      `Game Play log ${nextAction.tableId}: ${nextAction.action} ${nextAction.playerId}`,
    );
    this.emitNextEvent(nextAction);
  }

  @OnEvent('socketEvent.movePawnRes')
  handleMovePawnEvent(movePawnResponse: MovePawnEvent) {
    this.emitMovePawnEvent(movePawnResponse);
  }

  @OnEvent('socketEvent.turnSkipped')
  handleTurnSkippedEvent(turnSkip: TurnSkipEvent[]) {
    this.emitTurnSkipped(turnSkip);
  }

  @OnEvent('socketEvent.rollDiceRes')
  handleRollDiceEvent(rollDiceResponse: RollDiceEvent) {
    this.emitRollDiceEvent(rollDiceResponse);
  }

  @OnEvent('socketEvent.startGameRes')
  handleStartGameEvent(startGameResponse: StartGameEvent[]) {
    this.emitStartGameEvent(startGameResponse);
  }

  public emitGameFinishedEventAndLeave(endGameResponse: EndGameResponse[]) {
    for (const data of endGameResponse) {
      this.wss.to(data.userId).emit('gameEnd', data.response);
    }
  }

  public emitStartGameEvent(startGameResponse: StartGameEvent[]) {
    for (const data of startGameResponse) {
      this.wss.to(data.userId).emit('startGameRes', data.response);
    }
  }

  public emitTurnSkipped(turnSkip: TurnSkipEvent[]) {
    for (const data of turnSkip) {
      this.wss.to(data.userId).emit('turnSkipped', data.response);
    }
  }

  public emitLeaveWaitingTableEvent({
    userId,
    leaveWaitingTableResponse,
  }: LeaveWaitingTableEvent) {
    this.wss.to(userId).emit('leaveWaitingTableRes', leaveWaitingTableResponse);
  }

  public emitRollDiceEvent(rollDiceResponse: RollDiceEvent) {
    const { tableId } = rollDiceResponse;
    this.wss.to(tableId).emit('rollDiceRes', rollDiceResponse);
  }

  public emitLeaveTableEvent(leftTableResponse: LeftTableEvent[]) {
    for (const data of leftTableResponse) {
      this.wss.to(data.userId).emit('playerLeft', data.response);
    }
  }

  public emitMatchingTimeoutEvent(userIds: string[]) {
    this.wss.in(userIds).emit('matchingTimeout', {});
  }

  public emitNextEvent(nextAction: NextActionEvent) {
    const { tableId } = nextAction;
    this.wss.to(tableId).emit('next', nextAction);
  }

  public emitMovePawnEvent(movePawnResponse: MovePawnEvent) {
    const { tableId } = movePawnResponse;
    this.wss.to(tableId).emit('movePawnRes', movePawnResponse);
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
}
