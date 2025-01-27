import { Server, Socket } from 'socket.io';
import * as dayjs from 'dayjs';
import {
  Inject,
  Injectable,
  UseGuards,
  forwardRef,
  Logger,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import {
  WsClient,
  WsData,
  WsSubscribeMessage,
  WsUserID,
} from '@lib/fabzen-common/decorators/ws.decorator';
import { verifyJwtTokenInSocketIo } from '@lib/fabzen-common/utils/jwt.util';
import { ExtendedSocket, TableID, UserID } from '@lib/fabzen-common/types';
import { config } from '@lib/fabzen-common/configuration';

import { WsJwtGuard } from '../../../libs/fabzen-common/src/guards/ws-jwt.guard';
import { LudoGameplayController } from './ludo-gameplay.controller';
import {
  DiceValue,
  GameStatus,
  GameTypes,
  NextAction,
  PlayerId,
  PlayerInfo,
  GameFinishedMessage,
  JoinTableResponse,
  StartRoundEvent,
  TournamentStartEvent,
  RoundFinishedMessage,
  TournamentForceTerminatedEvent,
  ReconnectTournamentResponse,
  ReconnectNormalGameResponse,
  UserNameWithAvatar,
  MatchingTable,
  RecentWinner,
} from './ludo-gameplay.types';
import { RedisTransientDBService } from './services/transient-db/redis-backend';
import { CommonService } from './services/gameplay';
import {
  ChangeTableRequest,
  CheckIfJoinedRequest,
  EmojiData,
  ForceReconnectRequest,
  ForceReconnectTournamentRequest,
  GetLastGameEventRequest,
  GetLeftPlayerListRequest,
  IgnoreTournamentRequest,
  JoinTableRequest,
  LeaveTableRequest,
  MessageData,
  MovePawnRequest,
  ReadyToStartRequest,
  RollDiceRequest,
  SkipTurnRequest,
} from './ludo-gameplay.dto';
import {
  RoundEndResponse,
  TournamentChangedEvent,
} from 'apps/ludo-tournament/src/ludo-tournament.types';
import { LudoMaintenanceGuard } from './guards/maintenance-guard';
import { AuthenticatedSocket } from '@lib/fabzen-common/types/socket.types';

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class LudoGameplayGateway implements OnGatewayConnection {
  @WebSocketServer() wss!: Server;
  private readonly logger = new Logger(LudoGameplayGateway.name);

  constructor(
    @Inject(forwardRef(() => LudoGameplayController))
    private readonly ludoGameplayController: LudoGameplayController,
    private readonly transientDBService: RedisTransientDBService,
    @Inject(forwardRef(() => CommonService))
    private readonly commonService: CommonService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      verifyJwtTokenInSocketIo(client);
    } catch {
      client.disconnect(true);
      return;
    }
    const { user, id: socketId } = client as AuthenticatedSocket;
    const userId = user.userId;

    try {
      client.emit('serverTime', { time: dayjs().toISOString() });
      client.join(userId);
      this.wss.to(userId).except(socketId).emit('forceLogout', {
        cause: 'Logged in from other device',
      });
      this.wss.in(userId).except(socketId).disconnectSockets(true);

      // check this user has already joined table or not
      const reconnectionResponse =
        await this.ludoGameplayController.connected(userId);

      const { gameType, status, isReconnected } = reconnectionResponse;
      let eventName: string;
      let responseToEmit: any;
      let tableId: TableID | undefined;
      if (gameType === GameTypes.tournament) {
        eventName = 'reconnectTournament';
        const { table } = reconnectionResponse as ReconnectTournamentResponse;
        tableId = table?.tableId;
        if (tableId) {
          client.join(tableId);
        }
        responseToEmit = reconnectionResponse;
        // Delete gameType because it is not required for the Front-end
        delete responseToEmit['gameType'];
      } else {
        eventName = 'reconnectGame';
        tableId = (reconnectionResponse as ReconnectNormalGameResponse).tableId;
        const { gameInfo, waitingInfo, winner, winningAmount, tableTypeId } =
          reconnectionResponse as ReconnectNormalGameResponse;
        if (status === GameStatus.waiting) {
          responseToEmit = {
            status,
            isReconnected,
            tableTypeId,
            ...waitingInfo,
          };
        } else if (status === GameStatus.started) {
          responseToEmit = { status, isReconnected, tableTypeId, ...gameInfo };
        } else {
          responseToEmit = {
            isReconnected,
            status,
            tableId,
            winner,
            winningAmount,
          };
        }
      }
      if (tableId && status !== GameStatus.completed) {
        client.join(tableId);
      }

      client.emit(eventName, { ...responseToEmit, forceReconnect: false });
    } catch {
      client.emit('reconnectGame', {
        isReconnected: false,
        status: GameStatus.waiting,
        gameType: GameTypes.quick,
      });
    }
  }

  @WsSubscribeMessage('forceReconnect')
  async onReconnectEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(ForceReconnectRequest) { tableId }: ForceReconnectRequest,
  ) {
    try {
      const reconnectionResult =
        await this.ludoGameplayController.forceReconnect(userId, tableId);

      let eventName = 'reconnectGame';
      if ((reconnectionResult as ReconnectTournamentResponse).tournamentData) {
        eventName = 'reconnectTournament';
      }
      client.emit(eventName, { ...reconnectionResult, forceReconnect: true });
    } catch (error) {
      this.logger.error(`Error while force reconnecting`);
      this.logger.error(error);
      client.emit('reconnectGame', {
        isReconnected: false,
        status: GameStatus.waiting,
        gameType: GameTypes.furious4,
        tableId,
      });
    }
  }

  @WsSubscribeMessage('forceReconnectTournament')
  async onReconnectTournamentEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(ForceReconnectTournamentRequest)
    { tournamentId }: ForceReconnectTournamentRequest,
  ) {
    const reconnectionResult =
      await this.ludoGameplayController.forceReconnectTournament(
        tournamentId,
        userId,
      );

    const tableId = reconnectionResult.table?.tableId;

    if (tableId) {
      client.join(tableId);
    }
    client.emit('reconnectTournament', {
      ...reconnectionResult,
      forceReconnect: true,
    });
  }

  @WsSubscribeMessage('ping')
  onPing(client: ExtendedSocket) {
    client.emit('pong', {});
  }

  @WsSubscribeMessage('sendEmoji')
  async onSendEmojiEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(EmojiData) emojiData: EmojiData,
  ) {
    const tableId = emojiData.tableId ?? this.getTableIdFromSocket(client);
    if (tableId) {
      this.wss.to(tableId).emit('deliverEmoji', emojiData);
    }
  }

  @WsSubscribeMessage('sendMessage')
  async onSendMessagEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(MessageData) messageData: MessageData,
  ) {
    const tableId = messageData.tableId ?? this.getTableIdFromSocket(client);
    if (tableId) {
      this.wss.to(tableId).emit('deliverMessage', messageData);
    }
  }

  @UseGuards(LudoMaintenanceGuard)
  @WsSubscribeMessage('joinTable')
  async onJoinTableEvent(
    @WsUserID() userId: UserID,
    @WsData(JoinTableRequest) { tableTypeId }: JoinTableRequest,
  ) {
    await this.ludoGameplayController.joinTable(userId, tableTypeId);
  }

  @WsSubscribeMessage('checkIfJoined')
  async onCheckIfJoined(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(CheckIfJoinedRequest) { tableId }: CheckIfJoinedRequest,
  ) {
    try {
      const joinTableResponse =
        await this.ludoGameplayController.checkIfJoined(userId);
      if (joinTableResponse) {
        const tableId = joinTableResponse.tableId;
        client.join(tableId);
        client.emit('joinTableRes', joinTableResponse);
      } else if (tableId) {
        client.emit('discardGame', { tableId });
      } else {
        client.emit('notJoined', {});
      }
    } catch (error) {
      this.logger.debug(`Game Play log checkIfJoined ${userId} Error`);
      this.logger.error(error);
      client.emit('notJoined', {});
    }
  }

  @WsSubscribeMessage('readyToStart')
  async onReadyToStart(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(ReadyToStartRequest) readyToStartRequest: ReadyToStartRequest,
  ) {
    const tableId = readyToStartRequest.tableId;
    try {
      await this.ludoGameplayController.readyToStart({
        userId,
        ...readyToStartRequest,
      });
      await this.transientDBService.setUserActiveTableId(userId, tableId);
    } catch (error) {
      this.logger.error(`Game Play log ${userId}: readyToStart Error`);
      this.logger.error(error);
    } finally {
      client.emit('readyToStartAck', { tableId });
    }
  }

  @WsSubscribeMessage('getLastGameEvent')
  async getLastGameEvent(
    @WsClient() client: ExtendedSocket,
    @WsData(GetLastGameEventRequest) { tableId }: GetLastGameEventRequest,
  ) {
    const lastEvent = await this.commonService.getLastEvent(tableId);
    if (lastEvent) {
      const { eventName, eventPayload } = lastEvent;
      client.emit(eventName, eventPayload);
    }
  }

  @WsSubscribeMessage('rollDice')
  async onRollDice(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(RollDiceRequest) rollDiceRequest: RollDiceRequest,
  ) {
    const tableId =
      rollDiceRequest?.tableId || this.getTableIdFromSocket(client);
    if (tableId) {
      await this.ludoGameplayController.rollDice({
        tableId,
        userId,
      });
    }
  }

  @WsSubscribeMessage('movePawn')
  async onMovePawn(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(MovePawnRequest) movePawnRequest: MovePawnRequest,
  ) {
    const tableId =
      movePawnRequest?.tableId || this.getTableIdFromSocket(client);
    if (tableId) {
      const { pawn, dice } = movePawnRequest;
      const movedPawns = await this.ludoGameplayController.movePawn({
        tableId,
        pawn,
        dice,
        userId,
      });
      if (!movedPawns) {
        return;
      }
      const eventName = 'movePawnRes';
      const payload = { tableId, ...movedPawns };

      this.wss.to(tableId).emit(eventName, payload);
    }
  }

  @WsSubscribeMessage('leaveTable')
  async onLeaveTableEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(LeaveTableRequest) leaveTableRequest: LeaveTableRequest,
  ) {
    const tableId =
      leaveTableRequest?.tableId || this.getTableIdFromSocket(client);
    if (tableId) {
      await this.ludoGameplayController.leaveTable({ tableId, userId });
    }
  }

  @WsSubscribeMessage('leaveWaitingTable')
  async onLeaveWaitingEvent(@WsUserID() userId: UserID) {
    await this.ludoGameplayController.leaveWaitingTable(userId);
  }

  @WsSubscribeMessage('skipTurn')
  async onSkipTurnEvent(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(SkipTurnRequest) skipTurnRequest: SkipTurnRequest,
  ) {
    const tableId =
      skipTurnRequest?.tableId || this.getTableIdFromSocket(client);
    if (tableId) {
      await this.ludoGameplayController.skipTurn({ tableId, userId });
    }
  }

  @WsSubscribeMessage('ignoreTournamentRes')
  async ignoreTournament(
    @WsUserID() userId: UserID,
    @WsData(IgnoreTournamentRequest) { tournamentId }: IgnoreTournamentRequest,
  ) {
    await this.ludoGameplayController.ignoreTournament(tournamentId, userId);
  }

  @WsSubscribeMessage('changeTable')
  async changeTable(
    @WsClient() client: ExtendedSocket,
    @WsUserID() userId: UserID,
    @WsData(ChangeTableRequest) { tableId }: ChangeTableRequest,
  ) {
    const oldTableIds = this.getTableIdsFromSocket(client);
    for (const oldTableId of oldTableIds) {
      client.leave(oldTableId);
    }
    client.join(tableId);
    await this.transientDBService.setUserActiveTableId(userId, tableId);
  }

  @WsSubscribeMessage('getLeftPlayerList')
  async getLeftUserList(
    @WsClient() client: ExtendedSocket,
    @WsData(GetLeftPlayerListRequest)
    getLeftPlayerListRequest: GetLeftPlayerListRequest,
  ) {
    const tableId =
      getLeftPlayerListRequest?.tableId ?? this.getTableIdFromSocket(client);
    if (tableId) {
      const playerIds =
        await this.ludoGameplayController.getLeftPlayerList(tableId);
      client.emit('leftPlayerList', {
        playerIds,
      });
    }
  }

  @WsSubscribeMessage('subscribeMatchingTableList')
  async subscribeMatchingTableList(client: ExtendedSocket) {
    client.join('matchingTableListChannel');
  }

  @WsSubscribeMessage('unsubscribeMatchingTableList')
  async unsubscribeMatchingTableList(client: ExtendedSocket) {
    client.leave('matchingTableListChannel');
  }

  sendTableTimeout(userId: UserID, timeout: string) {
    this.wss.to(userId).emit('tableTimeout', { timeout });
  }

  notifyUserJoined(userIds: UserID[], usernames: UserNameWithAvatar[]) {
    if (userIds && userIds.length > 0) {
      this.wss.in(userIds).emit('usersJoinedTable', { usernames });
    }
  }

  startGame(joinTableResponse: JoinTableResponse) {
    const { players, tableId } = joinTableResponse;
    const userIds: UserID[] = [];
    const timeout = dayjs()
      .add(config.ludoGameplay.startTimeout, 'second')
      .toISOString();
    for (const { userId, playerId } of players) {
      this.logger.debug(`Game Play log ${tableId}: Start Game ${userId}`);
      this.wss.to(userId).emit('joinTableRes', {
        ...joinTableResponse,
        myPlayerId: playerId,
        timeout,
      });
      userIds.push(userId);
    }
    this.wss.in(userIds).socketsJoin(tableId);
  }

  reinitializeTable(joinTableResponse: JoinTableResponse) {
    const { players, tableId } = joinTableResponse;
    const userIds: UserID[] = [];
    for (const { userId, playerId } of players) {
      this.logger.debug(
        `Game Play log ${tableId}: Reinitialize Table ${userId}`,
      );
      this.wss.to(userId).emit('reinitializeTable', {
        ...joinTableResponse,
        myPlayerId: playerId,
      });
      userIds.push(userId);
    }
    this.wss.in(tableId).except(userIds).emit('discardGame', { tableId });
    this.wss.in(tableId).except(userIds).socketsLeave(tableId);
  }

  startRound(startRoundEvent: StartRoundEvent) {
    const { players, tableId } = startRoundEvent.table;
    const userIds: UserID[] = [];
    for (const { userId, playerId } of players) {
      startRoundEvent.table.myPlayerId = playerId as PlayerId;
      this.wss.to(userId).emit('roundWillStart', startRoundEvent);
      userIds.push(userId);
    }
    if (userIds.length > 1) {
      this.wss.in(userIds).socketsJoin(tableId);
    }
  }

  gameEnded(tableId: TableID, gameFinishedMessage: GameFinishedMessage) {
    const eventName = 'gameFinished';
    const payload: any = { tableId, ...gameFinishedMessage };
    this.wss.to(tableId).emit(eventName, payload);
  }

  roundEnded(tableId: TableID, roundFinishedMessage: RoundFinishedMessage) {
    const eventName = 'roundFinished';
    const payload = { tableId, ...roundFinishedMessage };
    this.wss.to(tableId).emit(eventName, payload);
  }

  tournamentFinished(roundEndResponse: RoundEndResponse) {
    const eventName = 'tournamentFinished';
    let payload;
    const {
      finished,
      tournamentId,
      tournamentName,
      lastRoundLeaderboard,
      noPlayersPerGame,
      responseRecipients,
    } = roundEndResponse;
    if (finished) {
      payload = { finished, tournamentId, tournamentName, noPlayersPerGame };
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      for (const { userId, prize, rank } of lastRoundLeaderboard!) {
        this.wss.to(userId).emit(eventName, {
          ...payload,
          rank,
          prize,
        });
      }
    } else {
      for (const userId of responseRecipients ?? []) {
        this.wss.to(userId).emit(eventName, {
          finished,
          tournamentId,
        });
      }
    }
  }

  next(tableId: TableID, nextAction: NextAction) {
    const eventName = 'next';
    const payload = { tableId, ...nextAction };
    this.wss.to(tableId).emit(eventName, payload);
  }

  rollDice(tableId: TableID, playerId: PlayerId, dice: DiceValue) {
    const eventName = 'rollDiceRes';
    const payload = { tableId, playerId, dice };
    this.wss.to(tableId).emit(eventName, payload);
  }

  recentWinners(recentWinners: { winners: RecentWinner[] }) {
    this.wss.emit('recentWinners', recentWinners);
  }

  tournamentWillStart(tournamentStartEvent: TournamentStartEvent) {
    const { userIds, ...payloadToEmit } = tournamentStartEvent;
    for (const userId of userIds) {
      this.wss.to(userId).emit('tournamentWillStart', payloadToEmit);
    }
  }

  leftTable(tableId: TableID, leftPlayer: PlayerInfo) {
    const { playerId, userId } = leftPlayer;
    this.wss.to(tableId).emit('playerLeftTable', { tableId, player: playerId });
    this.wss.in(userId).socketsLeave(tableId);
  }

  leaveSocketRoom(tableId: TableID, userId: UserID) {
    this.wss.in(userId).socketsLeave(tableId);
  }

  leftWaitingTable(userIds: UserID[]) {
    this.wss.in(userIds).emit('leaveWaitingTableRes', { status: true });
  }

  leaveWaitingTableFailed(userId: UserID) {
    this.wss.to(userId).emit('leaveWaitingTableRes', { status: false });
  }

  discardGame(tableId: TableID) {
    this.wss.to(tableId).emit('discardGame', { tableId });
    this.wss.in(tableId).socketsLeave(tableId);
  }

  async broadcastOnlineUserCount() {
    const count = await this.getOnlineUserCount();
    this.wss.emit('onlineUserCountRes', { count });
  }

  private getTableIdFromSocket(client: ExtendedSocket): TableID | undefined {
    const rooms = this.getTableIdsFromSocket(client);
    return rooms[0];
  }

  private getTableIdsFromSocket(client: ExtendedSocket): TableID[] {
    return [...client.rooms].filter((tableId) => tableId.length === 12);
  }

  async leaveRoomAllPlayers(tableId: string) {
    this.wss.in(tableId).socketsLeave(tableId);
  }

  async tournamentForceTerminated(
    tournamentForceTerminatedEvent: TournamentForceTerminatedEvent & {
      userIds: string[];
    },
  ) {
    const { userIds, ...payloadToEmit } = tournamentForceTerminatedEvent;
    for (const userId of userIds) {
      this.wss.to(userId).emit('tournamentForceTerminated', payloadToEmit);
    }
  }

  tournamentChanged(tournamentChangedEvent: TournamentChangedEvent) {
    this.wss.emit('tournamentChanged', tournamentChangedEvent);
  }

  sendMatchingTableList(matchingTables: MatchingTable[]) {
    this.wss
      .to('matchingTableListChannel')
      .emit('matchingTables', matchingTables);
  }

  async getOnlineUserCount() {
    const sockets = await this.wss.fetchSockets();
    const count = sockets ? sockets.length : 0;
    return count;
  }
}
