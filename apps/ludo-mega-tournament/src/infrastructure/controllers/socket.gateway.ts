import { Server, Socket } from 'socket.io';
import * as dayjs from 'dayjs';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';

import { verifyJwtTokenInSocketIo } from '@lib/fabzen-common/utils/jwt.util';
import {
  WsClient,
  WsData,
  WsSubscribeMessage,
  WsUserID,
} from '@lib/fabzen-common/decorators';
import { UserID } from '@lib/fabzen-common/types';
import { AuthenticatedSocket } from '@lib/fabzen-common/types/socket.types';

import {
  ForceReconnectRequest,
  GetLastGameEventRequest,
  LeaveTableRequest,
  MovePawnRequest,
  PlayRequest,
  ReadyToStartRequest,
  RollDiceRequest,
  SkipTurnRequest,
} from '.';
import { LudoMegaTournamentMaintenanceGuard } from '../../guards/maintenance-guard';
import {
  EndGameEvent,
  LudoMegaTournamentGameplayUseCases,
  MovePawnResponseEvent,
  NextActionEvent,
  RemainingMovesEvent,
  TournamentCanceledEvent,
} from '../../domain/use-cases';

@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class LudoMegaTournamentSocketGateway implements OnGatewayConnection {
  @WebSocketServer() wss: Server;
  private readonly logger = new Logger(LudoMegaTournamentSocketGateway.name);

  constructor(
    private readonly gameplayUserCases: LudoMegaTournamentGameplayUseCases,
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
    const { user, id: socketId } = client;
    const userId = user.userId;
    client.join(userId);
    this.wss.to(userId).except(socketId).emit('forceLogout', {
      cause: 'Logged in from other device',
    });
    this.wss.in(userId).except(socketId).disconnectSockets(true);
  }

  #sendServerTime(client: Socket) {
    client.emit('serverTime', { time: dayjs().toISOString() });
  }

  async #sendReconnectionData(client: AuthenticatedSocket) {
    const { userId } = client.user;
    const reconnectionData =
      await this.gameplayUserCases.getReconnectionData(userId);
    client.emit('reconnectGame', reconnectionData);
    const tableId = reconnectionData.tableInfo?.tableId;
    if (tableId) {
      client.join(tableId);
    }
  }

  @WsSubscribeMessage('forceReconnect')
  async forceReconnect(
    @WsClient() client: AuthenticatedSocket,
    @WsData(ForceReconnectRequest) { tableId }: ForceReconnectRequest,
  ) {
    const { userId } = client.user;
    const reconnectionData = await this.gameplayUserCases.forceReconnect(
      userId,
      tableId,
    );
    client.emit('reconnectGame', reconnectionData);
    if (reconnectionData.isReconnected) {
      client.join(tableId);
    }
  }

  @UseGuards(LudoMegaTournamentMaintenanceGuard)
  @WsSubscribeMessage('playTournamentGame')
  async onPlayEvent(
    @WsUserID() userId: UserID,
    @WsData(PlayRequest) { tournamentId }: PlayRequest,
    @WsClient() client: AuthenticatedSocket,
  ) {
    const startGameInfo = await this.gameplayUserCases.handlePlayRequest(
      userId,
      tournamentId,
    );
    client.join(startGameInfo.tableId);
    client.emit('tournamentGameStarted', startGameInfo);
  }

  @WsSubscribeMessage('readyToStart')
  async onReadyToStartEvent(
    @WsData(ReadyToStartRequest) { tableId }: ReadyToStartRequest,
    @WsClient() client: AuthenticatedSocket,
  ) {
    const nextAction = await this.gameplayUserCases.handleReadyToStart(tableId);
    client.emit('readyToStartAck', { tableId });
    if (nextAction) {
      client.emit('next', nextAction);
    }
  }

  @WsSubscribeMessage('rollDice')
  async onRollDiceEvent(
    @WsUserID() userId: UserID,
    @WsData(RollDiceRequest) { tableId }: RollDiceRequest,
    @WsClient() client: AuthenticatedSocket,
  ) {
    const dice = await this.gameplayUserCases.handleRollDice(tableId, userId);
    client.emit('rollDiceRes', { tableId, dice });
  }

  @WsSubscribeMessage('movePawn')
  async onMovePawnEvent(
    @WsUserID() userId: UserID,
    @WsData(MovePawnRequest) movePawnRequest: MovePawnRequest,
    @WsClient() client: AuthenticatedSocket,
  ) {
    const movePawnResponseEvent = await this.gameplayUserCases.handleMovePawn(
      userId,
      movePawnRequest,
    );
    client.emit('movePawnRes', movePawnResponseEvent);
  }

  @WsSubscribeMessage('skipTurn')
  async onSkipTurnEvent(@WsData(SkipTurnRequest) { tableId }: SkipTurnRequest) {
    await this.gameplayUserCases.handleSkipTurn(tableId);
  }

  @WsSubscribeMessage('leaveTable')
  async onLeaveTableEvent(
    @WsData(LeaveTableRequest) { tableId }: LeaveTableRequest,
  ) {
    await this.gameplayUserCases.handleEndGame(tableId);
  }

  @WsSubscribeMessage('getLastGameEvent')
  async getLastGameEvent(
    @WsUserID() userId: UserID,
    @WsClient() client: AuthenticatedSocket,
    @WsData(GetLastGameEventRequest) { tableId }: GetLastGameEventRequest,
  ) {
    const lastEvent = await this.gameplayUserCases.getLastEvent(
      tableId,
      userId,
    );
    if (lastEvent) {
      const { eventName, eventPayload } = lastEvent;
      client.emit(eventName, eventPayload);
    }
  }

  @OnEvent('socketEvent.nextAction')
  handleNextActionEvent(nextAction: NextActionEvent) {
    this.emitNextEvent(nextAction);
  }

  @OnEvent('socketEvent.endGame')
  handleEndGameEvent(endGameEvent: EndGameEvent) {
    this.emitGameFinishedEventAndLeave(endGameEvent);
  }

  @OnEvent('socketEvent.remainingMovesBonus')
  handleRemainingMovesBonusEvent(remainingMovesEvent: RemainingMovesEvent) {
    this.emitRemainingMovesBonusEvent(remainingMovesEvent);
  }

  @OnEvent('socketEvent.movePawnRes')
  handleMovePawnResEvent(movePawnResponseEvent: MovePawnResponseEvent) {
    this.emitMovePawnResEvent(movePawnResponseEvent);
  }

  @OnEvent('socketEvent.tournamentCanceled')
  handleTournamentCanceledEvent(
    tournamentCanceledEvent: TournamentCanceledEvent,
  ) {
    this.emitTournamentCanceledEvent(tournamentCanceledEvent);
  }

  public emitNextEvent(nextAction: NextActionEvent) {
    const { tableId } = nextAction;
    this.wss.to(tableId).emit('next', nextAction);
  }

  public emitGameFinishedEventAndLeave(endGameEvent: EndGameEvent) {
    const { tableId } = endGameEvent;
    this.wss.to(tableId).emit('gameFinished', endGameEvent);
    this.wss.in(tableId).socketsLeave(tableId);
  }

  public emitRemainingMovesBonusEvent(
    remainingMovesEvent: RemainingMovesEvent,
  ) {
    const { tableId } = remainingMovesEvent;
    this.wss.to(tableId).emit('remainingMovesBonus', remainingMovesEvent);
  }

  public emitMovePawnResEvent(movePawnResponseEvent: MovePawnResponseEvent) {
    const { tableId } = movePawnResponseEvent;
    this.wss.to(tableId).emit('movePawnRes', movePawnResponseEvent);
  }

  public emitTournamentCanceledEvent(
    tournamentCanceledEvent: TournamentCanceledEvent,
  ) {
    const { userIds, ...event } = tournamentCanceledEvent;
    this.wss.to(userIds).emit('tournamentCanceled', event);
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
