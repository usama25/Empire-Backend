import * as dayjs from 'dayjs';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { SLGameMatchingQueueUseCases } from './matching-queue.usecases';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { ClientProxy } from '@nestjs/microservices';
import {
  SLGameTableData,
  TransporterProviders,
  UserSLGameInfo,
  SLGameTableStatus,
} from '@lib/fabzen-common/types';
import { LockerService } from '@lib/fabzen-common/locker/locker.service';
import {
  GameAction,
  PlayerId,
  SLGameBoard,
  SLGameTable,
  START_TIMEOUT_IN_SECONDS,
} from '../../domain/entities';
import { SLGameTableRepository } from '../interfaces/game.repository';
import { SLGameTimerUseCases } from './game-timer.usecases';
import { Server } from 'socket.io';
import { SLMatchingQueueService } from '../interfaces/queue.service';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { WsJwtGuard } from '@lib/fabzen-common/guards/ws-jwt.guard';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { ScheduleService, SLGameMongooseRepository } from '../interfaces';
import {
  EndGameEvent,
  GameStatus,
  ReconnectionData,
  WaitingInfo,
} from './types';
import { MovePawnRequest } from '../../domain/entities/types.dto';
import { SLLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';
import { NotificationGateway } from '../interfaces/notification.gateway';

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class SLGameplayUseCases {
  @WebSocketServer() wss!: Server;
  private readonly logger = new Logger(SLGameplayUseCases.name);
  private readonly walletProvider: WalletProvider;
  constructor(
    private readonly configService: RemoteConfigService,
    private readonly gameTableRepository: SLGameTableRepository,
    private readonly userSLGameRepository: SLGameMongooseRepository,
    private readonly lockerService: LockerService,
    private readonly scheduleService: ScheduleService,
    private readonly notificationGateway: NotificationGateway,
    private readonly queueService: SLMatchingQueueService,
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => SLGameTimerUseCases))
    private readonly gameTimer: SLGameTimerUseCases,
    @Inject(forwardRef(() => SLGameMatchingQueueUseCases))
    private readonly matchingQueueUsecases: SLGameMatchingQueueUseCases,
    @Inject(TransporterProviders.WALLET_SERVICE)
    private walletClient: ClientProxy,
    private eventEmitter: EventEmitter2,
  ) {
    this.walletProvider = new WalletProvider(this.walletClient);
  }

  public async flushRedis() {
    await this.gameTableRepository.flushRedis();
  }

  public getTableTypeForReconnection(joinFee: string) {
    const slTables = this.configService.getSLGameTables();
    const slTable = slTables.find((table) => table.amount === joinFee);
    const tableType = {
      tableTypeId: slTable?.tableTypeId,
      amount: slTable?.amount,
      maxPlayer: slTable?.maxPlayer,
      winnings: slTable?.winnings,
    };
    return tableType;
  }

  public getBoardDataForReconnection(activeTable: SLGameTable) {
    const { users } = activeTable;
    const boardDatas = [];
    for (const user of users) {
      if (!user.didLeave) {
        const userIndex = users.findIndex(
          (userData) => userData.userId === user.userId,
        );
        const pawns = activeTable.pawns;
        const myPawns = [];
        for (const pawn of pawns) {
          if (pawn.playerIndex === userIndex) {
            myPawns.push({
              pawnId: `PW${pawn.playerIndex + 1}-${pawn.pawnIndex + 1}`,
              pos: pawn.calculatePoints(),
            });
          }
        }
        boardDatas.push({
          playerId: this.getPlayerId(activeTable, user.userId),
          score: this.getTotalScore(activeTable, user.userId),
          lives: users[userIndex].lives,
          pawnPos: myPawns,
        });
      }
    }
    const customedData = {
      setBoard: boardDatas,
    };
    return customedData;
  }

  async getReconnectionData(userId: string): Promise<ReconnectionData> {
    try {
      // Concurrently retrieve the active table ID and the waiting table type ID
      const [activeTable, waitingTableTypeId] = await Promise.all([
        this.gameTableRepository.retrieveUserActiveTable(userId),
        this.queueService.getUserWaitingTableTypeId(userId),
      ]);

      if (waitingTableTypeId && !activeTable) {
        const joinTableResponse = await this.getReconnectionDataForWaiting(
          userId,
          waitingTableTypeId,
        );
        const { amount: joinFee } =
          this.configService.getSLGameTableInfoByType(waitingTableTypeId);
        return {
          isReconnected: true,
          status: GameStatus.waiting,
          tableType: this.getTableTypeForReconnection(joinFee),
          joinTableRes: joinTableResponse,
        };
      }
      if (activeTable) {
        const {
          joinTableResponse,
          startGameResponse,
          tableInfo,
          boardData,
          diff,
        } = await this.getReconnectionDataForActiveGame(activeTable, userId);
        const nextAction = activeTable.generateNextAction();
        return diff > 15
          ? {
              isReconnected: true,
              status: GameStatus.started,
              tableType: this.getTableTypeForReconnection(activeTable.joinFee),
              joinTableRes: joinTableResponse,
              startGameRes: startGameResponse,
              tableInfo,
              setOngoingBoard: boardData,
              nextTurnRes: nextAction,
            }
          : {
              isReconnected: true,
              status: GameStatus.ongoing,
              tableType: this.getTableTypeForReconnection(activeTable.joinFee),
              joinTableRes: joinTableResponse,
              startGameRes: startGameResponse,
              tableInfo,
              setOngoingBoard: boardData,
              nextTurnRes: nextAction,
            };
      }
      return {
        isReconnected: false,
      };
    } catch (error) {
      console.error(
        `Error in getReconnectionData for userId ${userId}: ${error}`,
      );
      return {
        isReconnected: false,
      };
    }
  }

  private async getReconnectionDataForWaiting(
    userId: string,
    tableTypeId: string,
  ) {
    const { maxPlayer, matchingTime } =
      this.configService.getSLGameTableInfoByType(tableTypeId);
    const waitingUsers = await this.queueService.getUsersFromQueue(tableTypeId);
    const myPlayerId = this.getWaitingPlayerId(waitingUsers, userId, maxPlayer);
    const players = this.getWaitingTableUsers(waitingUsers, userId, maxPlayer);
    const playersWithPlayerId = players.map((player, index) => ({
      playerId: `PL${index + 1}` as PlayerId,
      playerInfo: player.userDetails,
    }));
    const matchingTimeout = this.matchingQueueUsecases
      .getMatchingTimeout(players, matchingTime, maxPlayer)
      .toISOString();
    return {
      myPlayerId,
      matchingTimeout,
      players: playersWithPlayerId,
    };
  }

  private async getReconnectionDataForActiveGame(
    activeTable: SLGameTable,
    userId: string,
  ) {
    const { id, users, joinFee, winAmount, currentTurn, dice, timeout, endAt } =
      activeTable;
    const currentTime = dayjs().unix();
    const timeoutInNumber = dayjs(timeout).unix();
    const diff = timeoutInNumber - currentTime;
    const features = this.configService.getSLGameFeatures();
    const turnTimeout = features.turnTimer;
    const startGameTimeOut = dayjs()
      .add(START_TIMEOUT_IN_SECONDS + diff - turnTimeout, 'seconds')
      .toISOString();
    const myPlayer = users.find((user) => user.userId === userId);
    if (!myPlayer) {
      throw new InternalServerErrorException(
        `User ${userId} not found in active table ${id}`,
      );
    }
    const playersWithPlayerId = users
      .filter((player) => !player.didLeave)
      .map((player) => ({
        playerId: player.playerId,
        playerInfo: {
          userId: player.userId,
          name: player.name,
          username: player.username,
          ip: player.ip,
          avatar: player.avatar,
          rank: player.rank,
          matches: player.matches,
          isKycVerified: player.isKycVerified,
          mobileNumber: player.mobileNumber,
          address: player.address,
          stats: player.stats,
        },
      }));

    const joinTableResponse = {
      myPlayerId: myPlayer.playerId,
      matchingTimeout: dayjs().toISOString(),
      players: playersWithPlayerId,
    };
    const startGameResponse = {
      tableId: id,
      joinFee,
      myPlayerId: this.getPlayerId(activeTable, userId),
      winAmount: winAmount,
      startGameTimeOut: startGameTimeOut,
      gameDurationTimeout: endAt,
    };
    const tableInfo = {
      tableId: id,
      joinFee,
      currentTurn,
      dice,
      timeout,
    };
    const boardData = this.getBoardDataForReconnection(activeTable);
    return { joinTableResponse, startGameResponse, tableInfo, boardData, diff };
  }

  async checkIfReconnected(userId: string): Promise<boolean> {
    try {
      // Concurrently retrieve the active table ID and the waiting table type ID
      const [activeTableId, waitingTableTypeId] = await Promise.all([
        this.gameTableRepository.retrieveUserActiveTableId(userId),
        this.queueService.getUserWaitingTableTypeId(userId),
      ]);

      return !!activeTableId || !!waitingTableTypeId;
    } catch (error) {
      console.error(
        `Error in checkIfReconnected for userId ${userId}: ${error}`,
      );
      return false; // Return false in case of any error
    }
  }

  async handleJoinTableRequest(
    userId: string,
    tableTypeId: string,
  ): Promise<{ waitingUsers: WaitingInfo[]; timeout: string }> {
    this.logger.log(`User ${userId} joins SL Game ${tableTypeId}`);
    const tableInfo = this.configService.getSLGameTableInfoByType(tableTypeId);

    await Promise.all([
      this.lockerService.acquireLock(tableTypeId),
      this.lockerService.acquireLock(userId),
    ]);
    try {
      const { amount: joinFee } = tableInfo;
      if (joinFee === '0') {
        const availableFreeGameCount =
          await this.userRepository.availableFreeGameCount(userId);
        if (availableFreeGameCount <= 0) {
          throw new BadRequestException(`No Free Game Available`);
        }
      }
      await this.checkWalletBalance(userId, joinFee);
      await this.sendNotificationIfBigTable(joinFee, userId);
      return await this.matchingQueueUsecases.putInQueue(userId, tableTypeId);
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableTypeId),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }

  private async sendNotificationIfBigTable(joinFee: string, myUserId: string) {
    const {
      isPushNotificationsEnabled,
      isSocketNotificationsEnabled,
      minimumJoinAmountForNotifications,
    } = this.configService.getSLMatchMakingNotificationConfig();

    if (Number(joinFee) < Number(minimumJoinAmountForNotifications)) {
      return;
    }
    const userIds = await this.queueService.getBigTableUsers();
    // exclude my userId
    const otherUserIds = userIds.filter((id) => id !== myUserId);
    if (isPushNotificationsEnabled) {
      await this.sendMatchMakingPushNotification(otherUserIds, joinFee);
    }
    if (isSocketNotificationsEnabled) {
      await this.sendMatchMakingSocketNotification(otherUserIds, joinFee);
    }
  }

  private async sendMatchMakingPushNotification(
    userIds: string[],
    joinFee: string,
  ) {
    const pnTitle = 'Play Now ‼️';
    const pnContent = `Oh no! You could not find a player. Don't worry. 😊
    Players are now available 🙋 at the ${joinFee} table. 😍
    Tap here to play! ✌️`;
    const deepLink = `emp://SnakesAndLadders/JoinTable=${joinFee}`;
    await this.notificationGateway.sendPushNotification(
      userIds,
      pnTitle,
      pnContent,
      deepLink,
    );
  }

  private async sendMatchMakingSocketNotification(
    userIds: string[],
    joinFee: string,
  ) {
    const deepLink = `emp://SnakesAndLadders/JoinTable=${joinFee}`;
    await this.notificationGateway.sendSocketNotification(userIds, deepLink);
  }

  async leaveWaitingTable(userId: string, tableTypeId: string) {
    this.logger.debug(`Game Play log leaveWaitingTable ${userId}`);
    await Promise.all([
      this.lockerService.acquireLock(tableTypeId),
      this.lockerService.acquireLock(userId),
    ]);
    try {
      const waitingTableTypeId =
        await this.queueService.getUserWaitingTableTypeId(userId);
      if (waitingTableTypeId !== tableTypeId) {
        return;
      }
      const tableInfo =
        this.configService.getSLGameTableInfoByType(tableTypeId);
      const { maxPlayer } = tableInfo;

      const oldWaitingUsers =
        await this.queueService.getUsersFromQueue(tableTypeId);

      const leftPlayerId = this.getWaitingPlayerId(
        oldWaitingUsers,
        userId,
        maxPlayer,
      );

      const affectedUsers = this.getWaitingTableUsers(
        oldWaitingUsers,
        userId,
        maxPlayer,
      );

      await this.queueService.removeUsersFromQueue(tableTypeId, [userId]);

      const newWaitingUsers =
        await this.queueService.getUsersFromQueue(tableTypeId);

      for (const {
        userDetails: { userId: affectedUserId },
      } of affectedUsers) {
        if (affectedUserId === userId) {
          this.eventEmitter.emit('socketEvent.leaveWaitingTable', {
            userId: affectedUserId,
            leaveWaitingTableResponse: {
              status: true,
              leftPlayerId,
              oldMyPlayerId: leftPlayerId,
              newMyPlayerId: leftPlayerId,
              players: [],
            },
          });
        } else {
          const players = this.getWaitingTableUsers(
            newWaitingUsers,
            affectedUserId,
            maxPlayer,
          );
          const playersWithPlayerId = players.map((player, index) => ({
            playerId: `PL${index + 1}` as PlayerId,
            playerInfo: player.userDetails,
          }));
          this.eventEmitter.emit('socketEvent.leaveWaitingTable', {
            userId: affectedUserId,
            leaveWaitingTableResponse: {
              status: true,
              leftPlayerId,
              myPlayerId: leftPlayerId,
              players: playersWithPlayerId,
            },
          });
        }
      }
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableTypeId),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }

  private getWaitingPlayerId(
    waitingUsers: WaitingInfo[],
    userId: string,
    maxPlayer: number,
  ): PlayerId {
    const sameWaitingTableUsers = this.getWaitingTableUsers(
      waitingUsers,
      userId,
      maxPlayer,
    );
    const myUserIndex = sameWaitingTableUsers.findIndex(
      (user) => user.userDetails.userId === userId,
    );

    const myPlayerId = `PL${myUserIndex + 1}` as PlayerId;
    return myPlayerId;
  }

  private getWaitingTableUsers(
    waitingUsers_: WaitingInfo[],
    userId: string,
    maxPlayer: number,
  ): WaitingInfo[] {
    // Clone the array to aviod in-place modification
    const waitingUsers = [...waitingUsers_];
    let myUserIndex = 0;
    while (waitingUsers.length > 0) {
      const sameWaitingTableUsers = waitingUsers.splice(0, maxPlayer);
      myUserIndex = sameWaitingTableUsers.findIndex(
        (user) => user.userDetails.userId === userId,
      );
      if (myUserIndex !== -1) {
        return sameWaitingTableUsers;
      }
    }

    return [];
  }

  async handleRollDice(userId: string, tableId: string) {
    this.logger.log(`Game Play Log ${tableId} rollDice ${userId}`);
    await Promise.all([
      this.lockerService.acquireLock(tableId),
      this.lockerService.acquireLock(userId),
    ]);
    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      if (userId !== gameTable.currentTurn) {
        return;
      }
      const dice = gameTable.rollDice();
      const users = gameTable.users;
      const index = users.findIndex((user) => user.userId === userId);
      const playerId = users[index].playerId;
      if (gameTable.checkIfPassTurnToNext(userId, gameTable)) {
        gameTable.action = GameAction.rollDice;
        //pass trun to next player
        gameTable.setNextTurn(gameTable.currentTurn);
        gameTable.updatedAt = new Date();
        await this.gameTableRepository.storeGameTable(gameTable);
        const nextAction = gameTable.generateNextAction();

        await this.gameTimer.startGameTimer({
          tableId: gameTable.id,
          targetCounter: gameTable.counter + 1,
          action: GameAction.skipTurn,
          delayInSeconds: gameTable.turnTimeout,
        });

        const rollDiceResponse = {
          tableId,
          playerId,
          dice,
        };

        console.log('rollDiceResponse', rollDiceResponse);

        this.eventEmitter.emit('socketEvent.rollDiceRes', rollDiceResponse);
        setTimeout(() => {
          this.eventEmitter.emit('socketEvent.nextAction', nextAction);
        }, 1000);
      } else {
        gameTable.action = GameAction.movePawn;
        gameTable.updatedAt = new Date();
        await this.gameTableRepository.storeGameTable(gameTable);
        const nextAction = gameTable.generateNextAction();

        await this.gameTimer.startGameTimer({
          tableId: gameTable.id,
          targetCounter: gameTable.counter + 1,
          action: GameAction.skipTurn,
          delayInSeconds: gameTable.turnTimeout,
        });

        const rollDiceResponse = {
          tableId,
          playerId,
          dice,
        };
        this.eventEmitter.emit('socketEvent.rollDiceRes', rollDiceResponse);
        setTimeout(() => {
          this.eventEmitter.emit('socketEvent.nextAction', nextAction);
        }, 1000);
      }
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableId),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }

  async handleMovePawn(movePawnRequest: MovePawnRequest) {
    const { tableId, pawnId } = movePawnRequest;
    await this.lockerService.acquireLock(tableId);
    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      const slGameBoard = await this.configService.getSLGameBoard();

      const dice = gameTable.dice;

      this.logger.log(`Game Play Log ${tableId} movePawn ${pawnId} ${dice}`);
      const {
        requireLongerDelay,
        movePawnResponseEvent,
        isHomeFlag,
        killPawnFlag,
        killPawnResponse,
      } = gameTable.movePawn(tableId, pawnId, dice, slGameBoard as SLGameBoard);

      this.eventEmitter.emit('socketEvent.movePawnRes', movePawnResponseEvent);

      if (isHomeFlag || killPawnFlag) {
        gameTable.action = GameAction.rollDice;
        gameTable.dice = 0;
        gameTable.updatedAt = new Date();
        await this.gameTableRepository.storeGameTable(gameTable);
        if (killPawnFlag) {
          const nextAction = {
            tableId: tableId,
            playerId: killPawnResponse.playerId,
            action: GameAction.pawnKill,
            turnTimeout: killPawnResponse.turnTimeout,
            killPawnId: killPawnResponse.killPawnId,
            scores: killPawnResponse.scores,
          };

          setTimeout(() => {
            this.eventEmitter.emit('socketEvent.nextAction', nextAction);
          }, 1000);
        }
      } else {
        gameTable.setNextTurn(gameTable.currentTurn);
        gameTable.action = GameAction.rollDice;
        gameTable.dice = 0;
        gameTable.updatedAt = new Date();
        await this.gameTableRepository.storeGameTable(gameTable);
      }

      if (gameTable.shouldEndGame()) {
        await this.handleEndGame(tableId);
      } else {
        const nextAction = gameTable.generateNextAction();
        setTimeout(
          () => {
            this.eventEmitter.emit('socketEvent.nextAction', nextAction);
          },
          requireLongerDelay ? 1500 : 1000,
        );
        await this.gameTimer.startGameTimer({
          tableId: gameTable.id,
          targetCounter: gameTable.counter + 1,
          action: GameAction.skipTurn,
          delayInSeconds: gameTable.turnTimeout,
        });
      }
    } finally {
      await this.lockerService.releaseLock(tableId);
    }
  }

  public removePawns(gameTable: SLGameTable, playerIndex: number) {
    const { pawns } = gameTable;
    const pawnCount = 2;
    const indexesToRemove = [];
    for (let pawnIndex = 1; pawnIndex <= pawnCount; pawnIndex++) {
      indexesToRemove.push(
        pawns.findIndex(
          (pawn) =>
            pawn.playerIndex === playerIndex && pawn.pawnIndex === pawnIndex,
        ),
      );
    }
    for (const index of indexesToRemove) {
      pawns.splice(index, 1);
    }
  }

  public getRemainingPlayers(gameTable: SLGameTable): UserSLGameInfo[] {
    const remainingPlayers = gameTable.users.filter((user) => !user.didLeave);
    return remainingPlayers;
  }

  private async checkWalletBalance(
    userId: string,
    joinFee: string,
  ): Promise<boolean> {
    this.logger.log(
      `Checking wallet balance for user ${userId} joinFee ${joinFee}`,
    );
    if (joinFee === '0') {
      return true;
    }
    return await this.walletProvider.checkSLWalletBalance(userId, joinFee);
  }

  async startGame(tableTypeId: string, waitingUsers: WaitingInfo[]) {
    const { amount: joinFee, winnings } =
      this.configService.getSLGameTableInfoByType(tableTypeId);
    if (Number(joinFee) === 0) {
      await Promise.all(
        waitingUsers.map(async (player) => {
          await this.userRepository.updatePlayedFreeGames(
            player.userDetails.userId,
          );
        }),
      );
    }
    const users = waitingUsers.map(({ userDetails }) => userDetails);
    const userIds = users.map(({ userId }) => userId);

    const winAmount = winnings[users.length - 2];

    const durations = this.configService.getSLGameDuration();
    const userCount = users.length;
    const gameDuration = Number(durations[userCount] ?? 0);
    const endAt = dayjs()
      .add(START_TIMEOUT_IN_SECONDS + gameDuration, 'seconds')
      .toISOString();
    const features = this.configService.getSLGameFeatures();
    const turnTimeout = features.turnTimer;
    const firstTurnTimeout = dayjs()
      .add(START_TIMEOUT_IN_SECONDS + turnTimeout, 'seconds')
      .toISOString();
    const status = GameStatus.ongoing;
    const gameTable = SLGameTable.create(
      users,
      joinFee,
      winAmount,
      status,
      firstTurnTimeout,
      turnTimeout,
      endAt,
    );

    this.wss.in(userIds).socketsJoin(gameTable.id);
    gameTable.updatedAt = new Date();
    await this.gameTableRepository.storeGameTable(gameTable, true);
    await this.debitJoinFee(userIds, gameTable.id, joinFee);
    this.scheduleService.scheduleEndGame(gameTable.id, endAt);
    await this.gameTimer.startGameTimer({
      tableId: gameTable.id,
      targetCounter: gameTable.counter + 1,
      action: GameAction.next,
      delayInSeconds: START_TIMEOUT_IN_SECONDS,
    });
    await this.gameTimer.startGameTimer({
      tableId: gameTable.id,
      targetCounter: gameTable.counter + 1,
      action: GameAction.skipTurn,
      delayInSeconds: START_TIMEOUT_IN_SECONDS + turnTimeout,
    });

    const timeOut = dayjs()
      .add(START_TIMEOUT_IN_SECONDS, 'seconds')
      .toISOString();
    this.logger.log(`Game Play Log ${gameTable.id} startGame`);
    const startGameResponse = userIds.map((userId) => ({
      userId,
      response: {
        tableId: gameTable.id,
        joinFee: joinFee,
        myPlayerId: this.getPlayerId(gameTable, userId),
        winAmount: winAmount,
        startGameTimeOut: timeOut,
        gameDurationTimeout: dayjs()
          .add(START_TIMEOUT_IN_SECONDS + gameDuration, 'seconds')
          .toISOString(),
      },
    }));

    this.eventEmitter.emit('socketEvent.startGameRes', startGameResponse);
    this.deleteBigTableUsersIfBigTable(joinFee, userIds);
  }

  private async deleteBigTableUsersIfBigTable(
    joinFee: string,
    userIds: string[],
  ) {
    const { minimumJoinAmountForNotifications } =
      this.configService.getSLMatchMakingNotificationConfig();
    if (Number(joinFee) >= Number(minimumJoinAmountForNotifications)) {
      await this.queueService.deleteBigTableUsers(userIds);
    }
  }

  public getPlayerId(table: SLGameTable, userId: string) {
    const users = table.users;
    const index = users.findIndex((user) => user.userId === userId);
    const playerId = users[index].playerId;
    return playerId;
  }

  public customizedPlayerInfo(userDatas: UserSLGameInfo[]) {
    const data = [];
    for (const userData of userDatas) {
      const rank = userData.rank === undefined ? '' : userData.rank;
      const stats = userData.stats === undefined ? '' : userData.stats;
      data.push({
        playerId: userData.playerId,
        userId: userData.userId,
        playerInfo: {
          name: userData.username,
          ip: userData.ip,
          avatar: userData.avatar,
          rank,
          stats,
        },
        isKycVerified: userData.isKycVerified,
        mobileNumber: userData.mobileNumber,
        lives: userData.lives,
      });
    }

    // Sort the putQueueResponse according to myPlayerId
    const sortedData = [...data].sort((a, b) => {
      return (
        this.getPlayerIdNumber(a.playerId) - this.getPlayerIdNumber(b.playerId)
      );
    });

    return sortedData;
  }

  public getPlayerIdNumber(playerId: PlayerId) {
    return Number.parseInt(playerId.replace('PL', ''), 10);
  }

  async handleNext(tableId: string) {
    //when the game is started, sendng next res to FE
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);
    const nextAction = gameTable.generateNextAction();
    setTimeout(() => {
      this.eventEmitter.emit('socketEvent.nextAction', nextAction);
    }, 1000);
  }

  async handleSkipTurn(tableId: string, userId: string) {
    const preTable = await this.gameTableRepository.retrieveGameTable(tableId);
    if (preTable.currentTurn !== userId) {
      return;
    }
    if (!preTable) {
      return;
    }
    const { gameTable, shouldLeave } = await preTable.skipTurn(preTable);
    gameTable.updatedAt = new Date();
    await this.gameTableRepository.storeGameTable(gameTable);
    const newTable = await this.gameTableRepository.retrieveGameTable(tableId);
    const users = newTable.users;
    if (shouldLeave) {
      await this.handleLeaveTable(newTable.id, newTable.currentTurn);
    } else {
      const currentTurn = newTable.currentTurn;
      const currentId = users.findIndex((user) => user.userId === currentTurn);
      const playerId = users[currentId].playerId;
      const lives = users[currentId].lives;
      const turnSkippedResponse = users
        .filter((user) => user.didLeave === false)
        .map((user) => ({
          userId: user.userId,
          response: {
            playerId,
            lives,
          },
        }));
      this.logger.log(`Game Play Log ${tableId} skipTurn ${userId}`);
      this.eventEmitter.emit('socketEvent.turnSkipped', turnSkippedResponse);
      // emit next
      newTable.setNextTurn(newTable.currentTurn);
      newTable.dice = 0;
      gameTable.updatedAt = new Date();
      await this.gameTableRepository.storeGameTable(newTable);
      if (newTable.shouldEndGame()) {
        await this.handleEndGame(tableId);
        return;
      }
      const nextAction = newTable.generateNextAction();

      setTimeout(() => {
        this.eventEmitter.emit('socketEvent.nextAction', nextAction);
      }, 1000);
      await this.gameTimer.startGameTimer({
        tableId: newTable.id,
        targetCounter: newTable.counter + 1,
        action: GameAction.skipTurn,
        delayInSeconds: newTable.turnTimeout,
      });
    }
  }

  async handleLeaveTable(tableId: string, userId: string) {
    this.logger.log(`Game Play log ${tableId}: Leave Table ${userId}`);
    await Promise.all([
      this.lockerService.acquireLock(tableId),
      this.lockerService.acquireLock(userId),
    ]);
    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      if (!gameTable) {
        return;
      }
      const { id, users, currentTurn } = gameTable;
      const index = users.findIndex((user) => user.userId === userId);
      const leftPlayer = users[index];
      const playerId = leftPlayer.playerId;

      const leftTableResponse = users
        .filter((user) => user.didLeave === false)
        .map((user) => ({
          userId: user.userId,
          response: {
            tableId: id,
            playerId,
          },
        }));
      //send response to users including currently leaving user

      this.eventEmitter.emit('socketEvent.leaveTable', leftTableResponse);

      //after sending playerLeft response, update table data
      await this.gameTableRepository.deleteUserTableCache(userId);
      leftPlayer.didLeave = true;
      gameTable.updatedAt = new Date();
      await this.gameTableRepository.storeGameTable(gameTable);

      const remainingPlayers = this.getRemainingPlayers(gameTable);
      if (remainingPlayers.length === 1) {
        //in thic case the game should be finished
        await this.handleEndGame(id);
      } else {
        if (leftPlayer.userId === currentTurn) {
          gameTable.setNextTurn(userId);
          gameTable.incrementCounterAndTimeout();
          gameTable.action = GameAction.rollDice;
          gameTable.updatedAt = new Date();
          await this.gameTableRepository.storeGameTable(gameTable);
          const nextAction = gameTable.generateNextAction();
          setTimeout(() => {
            this.eventEmitter.emit('socketEvent.nextAction', nextAction);
          }, 1000);
          const counter = gameTable.counter;
          const turnTimeout = gameTable.turnTimeout;
          await this.gameTimer.startGameTimer({
            tableId: id,
            targetCounter: counter + 1,
            action: GameAction.skipTurn,
            delayInSeconds: turnTimeout,
          });
        }
      }
      await this.userSLGameRepository.createSLGameHistory(gameTable, userId);
      this.wss.in(userId).socketsLeave(tableId);
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableId),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }

  public getTableTypeId(joinFee: string) {
    const slTables = this.configService.getSLGameTables();

    const slTable = slTables.find((table) => table.amount === joinFee);
    if (!slTable) {
      throw new BadRequestException(`No Table Type with id ${joinFee}`);
    }
    const tableTypeId = slTable?.tableTypeId;
    return tableTypeId;
  }
  public getSum(score: number[]) {
    let sum: number = 0;
    for (const value of score) {
      sum += value;
    }
    return sum;
  }

  async handleEndGame(tableId: string) {
    this.logger.log(`Game Play Log ${tableId} endGame`);
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);
    if (gameTable.status === GameStatus.completed) {
      return;
    }
    gameTable.status = GameStatus.completed;
    gameTable.updatedAt = new Date();
    await this.gameTableRepository.storeGameTable(gameTable);

    const users = gameTable.users;
    const userIds = users.map((user) => user.userId);
    const endGameDatas: EndGameEvent[] = [];
    for (const userId of userIds) {
      const userIndex = userIds.indexOf(userId);
      const winAmount =
        this.isWinner(
          gameTable,
          this.getSum(gameTable.calculateTotalPointsOfMyPawns(userIndex)),
        ) && !users[userIndex].didLeave
          ? (
              Number.parseFloat(gameTable.winAmount) /
              this.getNumberOfWinners(gameTable)
            ).toString()
          : '0';
      const endGameData: EndGameEvent = {
        playerId: users[userIndex].playerId,
        name: users[userIndex].name ?? users[userIndex].username,
        avatar: users[userIndex].avatar,
        totalScore: this.getTotalScore(gameTable, userId),
        winAmount: winAmount,
        isWinner:
          this.isWinner(
            gameTable,
            this.getSum(gameTable.calculateTotalPointsOfMyPawns(userIndex)),
          ) && !users[userIndex].didLeave,
      };
      endGameDatas.push(endGameData);
      //sending money to wininer
      if (
        this.isWinner(
          gameTable,
          this.getSum(gameTable.calculateTotalPointsOfMyPawns(userIndex)),
        ) &&
        !users[userIndex].didLeave
      ) {
        await this.walletProvider.creditSLWinningAmount(
          [userId],
          (
            Number.parseFloat(gameTable.winAmount) /
            this.getNumberOfWinners(gameTable)
          ).toString(),
          tableId,
        );
      }

      this.wss.in(userId).socketsLeave(tableId);
    }
    const endGameDataResponse = users
      .filter((user) => user.didLeave === false)
      .map((user) => ({
        userId: user.userId,
        response: {
          tableId: tableId,
          players: endGameDatas,
        },
      }));
    setTimeout(() => {
      this.eventEmitter.emit('socketEvent.gameEndRes', endGameDataResponse);
    }, 500);
    const userIdsForDeleteCacheTable = users
      .filter((user) => user.didLeave === false)
      .map((user) => user.userId);
    await this.userSLGameRepository.createSLGameHistory(gameTable);
    await this.gameTableRepository.deleteGameTable(
      tableId,
      userIdsForDeleteCacheTable,
    );
  }

  public getNumberOfWinners(gameTable: SLGameTable) {
    const users = gameTable.users;
    const scores: number[] = [];
    for (const user of users) {
      if (!user.didLeave) {
        const userIndex = users.findIndex(
          (userInfo) => user.userId === userInfo.userId,
        );
        scores.push(
          this.getSum(gameTable.calculateTotalPointsOfMyPawns(userIndex)),
        );
      }
    }
    const maxValue = Math.max(...scores);
    const maxCount = scores.filter((score) => score === maxValue).length;
    return maxCount;
  }

  public getTotalScore(gameTable: SLGameTable, userId: string): string {
    const users = gameTable.users;
    const userIndex = users.findIndex((user) => user.userId === userId);
    const score = gameTable.calculateTotalPointsOfMyPawns(userIndex);
    return this.getSum(score).toString();
  }

  public isWinner(gameTable: SLGameTable, userScore: number) {
    const users = gameTable.users;
    const scores: number[] = [];
    for (const user of users) {
      if (!user.didLeave) {
        const userIndex = users.findIndex(
          (userInfo) => user.userId === userInfo.userId,
        );
        scores.push(
          this.getSum(gameTable.calculateTotalPointsOfMyPawns(userIndex)),
        );
      }
    }
    const maxValue = Math.max(...scores);

    return maxValue === userScore;
  }

  async debitJoinFee(userIds: string[], tableId: string, joinFee: string) {
    for (const userId of userIds) {
      const isBalanceEnough = await this.walletProvider.checkSLWalletBalance(
        userId,
        joinFee,
      );
      if (!isBalanceEnough) {
        throw new BadRequestException(
          `User ${userId} has insufficient wallet balance`,
        );
      }
    }
    await this.walletProvider.debitSLJoinFee(
      userIds,
      joinFee as string,
      tableId,
    );
  }

  async getGameTablePlayersFromTable(
    tableId: string,
  ): Promise<SLGameTableData[]> {
    const tableIds = await this.gameTableRepository.getActiveTableIds();
    const _tableId = tableIds.find(
      (id) => id.toLowerCase() === tableId.toLowerCase(),
    );
    if (!_tableId) {
      return [];
    }
    const table = await this.gameTableRepository.getActiveTable(_tableId);
    if (!table) {
      return [];
    }

    const tableStatus =
      table.updatedAt && dayjs().diff(table.updatedAt) >= 60_000
        ? SLGameTableStatus.stuck
        : SLGameTableStatus.ongoing;
    const playersData = table.users.map((user) => ({
      playerId: user.playerId,
      userId: user.userId,
      name: user.name,
      username: user.username,
      didLeave: user.didLeave,
    }));
    return [
      {
        tableId: table.id,
        joinFee: table.joinFee,
        status: tableStatus,
        players: playersData,
        startedAt: table.startedAt,
        updatedAt: table.updatedAt,
      },
    ];
  }

  async getGameTable(
    tableId?: string,
    userId?: string,
    amount?: string,
  ): Promise<SLGameTableData[]> {
    if (tableId) {
      return this.getGameTablePlayersFromTable(tableId);
    } else if (userId) {
      const tableId =
        await this.gameTableRepository.retrieveUserActiveTableId(userId);
      if (!tableId) {
        return [];
      }
      return this.getGameTablePlayersFromTable(tableId);
    } else {
      const tableIds = await this.gameTableRepository.getActiveTableIds();
      const tableData: SLGameTableData[] = [];
      await Promise.all(
        tableIds.map(async (tableId) => {
          const data = await this.getGameTablePlayersFromTable(tableId);
          if (amount && data[0].joinFee === amount) {
            tableData.push(data[0]);
          }
          if (!amount) {
            tableData.push(data[0]);
          }
        }),
      );
      return tableData;
    }
  }

  public convertGameTableData(tables: SLGameTableData[]) {
    const joinFeeList = this.extractJoinFeeList(tables);
    const convertedData = [];
    for (const joinFee of joinFeeList) {
      const tablesForJoinFee = tables.filter(
        (table) => table.joinFee === joinFee,
      );
      convertedData.push({
        joinFee: joinFee,
        totalNumber: tablesForJoinFee.length,
        tables: tablesForJoinFee,
      });
    }
    return convertedData;
  }

  async getGameTables(sLLiveGamesRequest: SLLiveGamesRequest) {
    const { tableId, userId, amount, skip, count } = sLLiveGamesRequest;
    let gameTables = await this.getGameTable(tableId, userId, amount);
    gameTables = gameTables.slice(skip, skip + count);
    const ongoingTables = gameTables.filter(
      (table) => table.updatedAt && dayjs().diff(table.updatedAt) < 60_000,
    );

    let stuckTables = gameTables.filter(
      (table) => table.updatedAt && dayjs().diff(table.updatedAt) >= 60_000,
    );
    const totalGameData = await this.getGameTable();
    const totalStuckTables = totalGameData.filter(
      (table) => table.updatedAt && dayjs().diff(table.updatedAt) >= 60_000,
    );
    const totalStuckTableCount = totalStuckTables.length;
    stuckTables = stuckTables.slice(skip, skip + count);
    const stuckTableCount = stuckTables.length;

    const joinFeeList = this.getJoinFeeList();
    let totalWaitingUserCount = 0;
    const waitingUserList = [];
    for (const data of joinFeeList) {
      const waitingUsers = await this.queueService.getUsersFromQueue(
        this.getTableTypeId(data.joinFee),
      );
      const waitingUserInfo = waitingUsers.map((user) => ({
        userId: user.userDetails.userId,
        username: user.userDetails.username,
      }));
      waitingUserList.push({
        joinFee: data.joinFee,
        totalNumber: waitingUsers.length,
        players: waitingUserInfo,
      });
      totalWaitingUserCount += waitingUsers.length;
    }
    let liveUserCount = 0;
    for (const data of gameTables) {
      const liveUsers = data.players.filter((user) => user.didLeave === false);
      liveUserCount += liveUsers.length;
    }
    return {
      gameTables: this.convertGameTableData(ongoingTables),
      stuckTables: this.convertGameTableData(stuckTables),
      stuckTableCount,
      totalStuckTables: this.convertGameTableData(totalStuckTables),
      totalStuckTableCount,
      totalTableCount: totalGameData.length,
      totalWaitingUserCount,
      waitingUserList,
      liveUserCount,
      totalLiveUserCount: totalGameData.reduce(
        (accumulator, table) =>
          accumulator +
          table.players.filter((user) => user.didLeave === false).length,
        0,
      ),
    };
  }

  private extractJoinFeeList(tables: SLGameTableData[]) {
    const joinFeeList = [...new Set(tables.map((table) => table.joinFee))];
    return joinFeeList;
  }

  private getJoinFeeList(): Array<{ joinFee: string; maxPlayer: number }> {
    const slTables = this.configService.getSLGameTables();
    const joinFeeList = slTables.map((table) => ({
      joinFee: table.amount,
      maxPlayer: table.maxPlayer,
    }));
    return joinFeeList;
  }

  async clearTable(tableId: string) {
    // reward last amounts
    const table = (await this.gameTableRepository.getActiveTable(
      tableId,
    )) as SLGameTable;
    if (table !== undefined) {
      const userIds = table.users.map((user) => user.userId);
      const joinFee = table.joinFee;
      await this.refundStuckTable(userIds, joinFee, tableId);
      await this.gameTableRepository.deleteGameTable(tableId, userIds);
      return true;
    }
    return false;
  }

  async refundStuckTable(userIds: string[], amount: string, tableId: string) {
    await this.walletProvider.refundJoinFeeForSLGame(
      userIds,
      amount,
      tableId,
      true,
    );
  }
}
