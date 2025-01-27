import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EPLGameMatchingQueueUseCases } from './matching-queue.usecases';
import { LockerService } from '@lib/fabzen-common/locker/locker.service';
import { EPLPlayerRole, GameStatus, WaitingInfo } from './types';
import {
  PLAYERS_PER_GAME,
  TABLE_TIMEOUT_IN_SECONDS,
  TOTAL_NUMBER_OF_TURNS,
  TURN_TIMEOUT_DELAY,
  TURN_TIMEOUT_IN_SECONDS,
} from '../entities/constants';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { WalletServiceGateway } from '../interfaces/wallet-service.gateway';
import {
  EPLGameAction,
  EPLGameTable,
  PlayerId,
  UserEPLGameInfo,
} from '../entities';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EPLGameTableRepository, EPLMatchingQueueService } from '../interfaces';
import * as dayjs from 'dayjs';
import { EPLGameTimerUseCases } from './game-timer.usecases';
import { config } from '@lib/fabzen-common/configuration/configuration';
import { EPLRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class EPLGameplayUseCases {
  @WebSocketServer() wss!: Server;
  private readonly logger = new Logger(EPLGameplayUseCases.name);

  constructor(
    private readonly configService: EPLRemoteConfigService,
    private readonly gameTableRepository: EPLGameTableRepository,
    private readonly lockerService: LockerService,
    @Inject(forwardRef(() => EPLGameMatchingQueueUseCases))
    private readonly matchingQueueUsecases: EPLGameMatchingQueueUseCases,
    private readonly walletServiceGateway: WalletServiceGateway,
    @Inject(forwardRef(() => EPLGameTimerUseCases))
    private readonly gameTimer: EPLGameTimerUseCases,
    private readonly queueService: EPLMatchingQueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleJoinTableRequest(
    userId: string,
    tableTypeId: string,
  ): Promise<{
    waitingUsers: WaitingInfo[];
    timeout: string;
  }> {
    console.log(
      `User ${userId} joins EPL Game with table type id ${tableTypeId}`,
    );
    const tableInfo =
      this.configService.getEPLGameTableInfoByTableTypeId(tableTypeId);

    await Promise.all([
      this.lockerService.acquireLock(tableTypeId),
      this.lockerService.acquireLock(userId),
    ]);
    try {
      const { tableTypeId, amount } = tableInfo;
      await this.checkWalletBalance(userId, amount);
      return await this.matchingQueueUsecases.putInQueue(userId, tableTypeId);
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableTypeId),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }

  public async flushRedis() {
    if (!config.isProduction) {
      await this.gameTableRepository.flushRedis();
    }
  }

  async handleTurnTimeout(tableId: string) {
    console.log(`Handling turn timeout for table ${tableId}`);
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);
    // Check if the game is completed
    if (gameTable.status === GameStatus.completed) {
      console.log(`Game ${tableId} has ended. Skipping turn timeout.`);
      return;
    }

    console.log(
      `Current turnNo: ${gameTable.turnNo}, Inning: ${gameTable.innings}`,
    );

    const { turnTimer } = this.configService.getEPLFeatures();
    const turnTimeout = dayjs().add(turnTimer, 'seconds').toISOString();
    const turnTimeoutResponse = gameTable.users.map((user) => ({
      userId: user.userId,
      tableId: gameTable.id,
      playerRole: user.role,
      timeout: turnTimeout,
    }));

    this.eventEmitter.emit('socketEvent.turnTimeout', turnTimeoutResponse);
    await this.gameTableRepository.storeGameTable(gameTable);
  }

  async handleInningStart(tableId: string) {
    console.log(`Handling inning start for table ${tableId}`);

    // Retrieve the game table information
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);

    // Check if the game is completed
    if (gameTable.status === GameStatus.completed) {
      console.log(`Game ${tableId} has ended. Skipping inning start.`);
      return;
    }
    const tableTimeout = dayjs()
      .add(TABLE_TIMEOUT_IN_SECONDS, 'seconds')
      .toISOString();
    // const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);
    console.log(
      `Inning: ${gameTable.innings}, turnNo before start: ${gameTable.turnNo}`,
    );

    const inningStartResponse = gameTable.users.map((user) => ({
      userId: user.userId,
      response: {
        tableId: gameTable.id,
        amount: gameTable.amount,
        innings: gameTable.innings,
        winAmount: gameTable.winAmount,
        startGameTimeout: tableTimeout,
        players: gameTable.users.map((player) => ({
          playerId: player.playerId,
          role: player.role,
        })),
        ...(gameTable.innings === 2 && { targetScore: gameTable.targetScore }),
      },
    }));

    gameTable.turnNo = 1;
    gameTable.isOut = false;

    try {
      this.eventEmitter.emit('socketEvent.inningStarted', inningStartResponse);
    } catch (error) {
      console.error('Error emitting inningStarted event:', error);
      throw error;
    }

    await this.gameTableRepository.storeGameTable(gameTable);

    // Schedule the first turn events after a delay
    // if (gameTable.status !== GameStatus.completed) {
    setTimeout(
      () => this.scheduleTurnEvents(tableId),
      (TABLE_TIMEOUT_IN_SECONDS + TURN_TIMEOUT_DELAY) * 1000,
    );
    // }
  }

  private async scheduleTurnEvents(tableId: string) {
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);

    // Check if the game is completed
    if (gameTable.status === GameStatus.completed) {
      console.log(`Game ${tableId} has ended. Skipping turn events.`);
      return;
    }

    if (gameTable.turnNo > TOTAL_NUMBER_OF_TURNS) {
      await this.calculateTargetScore(tableId).then(() =>
        console.log('calculated target score'),
      );
      await this.gameTimer.startGameTimer({
        tableId,
        action: EPLGameAction.inningEnd,
        delayInSeconds: 0,
      });
      return;
    }

    await this.handleTurnTimeout(tableId);
    await delay(TURN_TIMEOUT_IN_SECONDS * 1000);
    await this.handleTurnResult(tableId);

    // if (gameTable.status !== GameStatus.completed) {
    setTimeout(
      () => this.scheduleTurnEvents(tableId),
      TURN_TIMEOUT_DELAY * 1000,
    );
    // }
    // Schedule next turn events
  }

  async handleInningEnd(tableId: string) {
    console.log(`Handling inning end for table ${tableId}`);
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);
  
    if (gameTable.innings === 1) {
      console.log('Ending first inning, preparing for second inning');
      // targetScore is now set in calculateAndUpdateScore
      gameTable.innings = 2;
      gameTable.turnNo = 1;
      gameTable.isOut = false;
      console.log(`Reset turnNo to 1 for second inning`);
  
      // Swap roles for the second inning
      for (const user of gameTable.users) {
        user.role =
          user.role === EPLPlayerRole.batsman
            ? EPLPlayerRole.bowler
            : EPLPlayerRole.batsman;
        user.score = '0';
        user.runs = 0;
      }
  
      await this.gameTableRepository.storeGameTable(gameTable);
      await this.handleInningStart(tableId);
    } else if (gameTable.innings === 2) {
      gameTable.status = GameStatus.completed;
      await this.gameTableRepository.storeGameTable(gameTable);
      await this.handleGameEnded(tableId);
    }
  }

  async handleGameEnded(tableId: string) {
    console.log(`Handling game ended for table ${tableId}`);
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);
    
    if (gameTable.status !== GameStatus.completed) {
      console.log(`Game ${tableId} is not completed. Skipping gameEnd event.`);
      return;
    }

    const batsman = gameTable.users.find(
      (user) => user.role === EPLPlayerRole.batsman,
    );
    const bowler = gameTable.users.find(
      (user) => user.role === EPLPlayerRole.bowler,
    );
  
    let winner: typeof batsman | typeof bowler | undefined;
    let gameResult: 'won' | 'draw' = 'draw';
    if (batsman && bowler) {
      const batsmanScore = Number(batsman.score);
      const bowlerScore = Number(bowler.score);
      if (batsmanScore > bowlerScore) {
        winner = batsman;
        gameResult = 'won';
      } else if (batsmanScore < bowlerScore) {
        winner = bowler;
        gameResult = 'won';
      }
    }
  
    const winAmount = winner ? Number(gameTable.winAmount) : 0;
  
    const gameEndResponse = {
      tableId: gameTable.id,
      gameResult,
      players: gameTable.users.map((user) => ({
        userId: user.userId,
        playerId: user.playerId,
        name: user.username,
        avatar: user.avatar,
        score: user.score,
        winAmount: user.userId === winner?.userId ? winAmount.toString() : '0',
        isWinner: user.userId === winner?.userId,
      })),
    };
  
    this.eventEmitter.emit('socketEvent.gameEnded', gameEndResponse);
    console.log('Game Ended', tableId);
  }

  async handleTurnResult(tableId: string) {
    let gameTable = await this.gameTableRepository.retrieveGameTable(tableId);
    console.log('GAME TABLE IS', gameTable);
    if (gameTable.batBowlAction) {
      await this.calculateAndUpdateScore(tableId);
      gameTable.batBowlAction = false;
    }

    gameTable = await this.gameTableRepository.retrieveGameTable(tableId);

    // console.log('GAME TABLE IS ', gameTable)
    const turnResultResponse = gameTable.users.map((user) => ({
      userId: user.userId,
      turnNo: gameTable.turnNo,
      isOut: gameTable.isOut,
      players: gameTable.users.map((player) => ({
        playerId: player.playerId,
        runs: player.runs,
        role: player.role,
        score: player.score,
      })),
      targetScore: gameTable.targetScore, // Include targetScore in the response
    }));

    this.eventEmitter.emit('socketEvent.turnResult', turnResultResponse);

    gameTable.users = gameTable.users.map((user) => {
      user.runs = 0;
      console.log(`Reset runs for ${user.userId}: ${user.runs}`);
      return user;
    });

    if (gameTable.isOut) {
      // Delay for 1 second before starting the next inning
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await this.calculateTargetScore(tableId).then(() =>
        console.log('calculated target score'),
      );
      await this.gameTimer.startGameTimer({
        tableId,
        action: EPLGameAction.inningEnd,
        delayInSeconds: 0,
      });
    } else if (gameTable.innings === 2) {
      const batsman = gameTable.users.find(
        (user) => user.role === EPLPlayerRole.batsman,
      );
      if (batsman && Number(batsman.score) > Number(gameTable.targetScore)) {
        // Delay for 1 second before ending the game
        await new Promise((resolve) => setTimeout(resolve, 1000));
        gameTable.status = GameStatus.completed;
        await this.handleGameEnded(tableId);
      } else {
        gameTable.turnNo += 1;
        await this.gameTableRepository.storeGameTable(gameTable);
      }
    } else {
      gameTable.turnNo += 1;
      await this.gameTableRepository.storeGameTable(gameTable);
    }
  }

  private async calculateAndUpdateScore(tableId: string) {
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);

    for (const user of gameTable.users) {
      if (!user.score) {
        user.score = '0';
      }

      user.score = (Number(user.score) + (user.runs || 0)).toString();

      console.log(`Updated score for ${user.userId}: ${user.score}`);
    }

    await this.gameTableRepository.storeGameTable(gameTable);
    console.log('GAME TABLE AFTER UPDATING SCORE', gameTable);
  }

  private async calculateTargetScore(tableId: string): Promise<string | void> {
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);
    const batsman = gameTable.users.find(
      (user) => user.role === EPLPlayerRole.batsman,
    );
    if (batsman) {
      const batsmanScore = Number(batsman.score);
      if (batsmanScore > 0) {
        gameTable.targetScore = (batsmanScore + 1).toString();
        console.log(`Updated targetScore: ${gameTable.targetScore}`);
      }
    }

    await this.gameTableRepository.storeGameTable(gameTable);
    return gameTable.targetScore;
  }

  private async checkWalletBalance(
    userId: string,
    joinFee: string,
  ): Promise<boolean> {
    this.logger.log(
      `Checking wallet balance for user ${userId} tableTypeId ${joinFee}`,
    );

    return await this.walletServiceGateway.checkEPLWalletBalance(
      userId,
      joinFee,
    );
  }

  calculateWinAmount(gameTable: EPLGameTable): string {
    const amount = Number(gameTable.amount);
    const winAmount = amount * 2;
    const finalWinAmount = winAmount - 0;
    return finalWinAmount.toString();
  }

  async startGame(tableTypeId: string, waitingUsers: WaitingInfo[]) {
    try {
      const { amount, winnings } =
        this.configService.getEPLGameTableInfoByTableTypeId(tableTypeId);
      const users = waitingUsers.map(({ userDetails }) => userDetails);
      const userIds = users.map(({ userId }) => userId);

      const winAmount = winnings[users.length - 2];
      const status = GameStatus.ongoing;
      const gameTable = EPLGameTable.create(users, amount, winAmount, status);

      try {
        this.wss.in(userIds).socketsJoin(gameTable.id);
      } catch (error) {
        console.error('Error joining sockets to game table:', error);
        throw error;
      }

      gameTable.updatedAt = new Date();

      await this.gameTableRepository.storeGameTable(gameTable, true);

      await this.debitJoinFee(userIds, amount, gameTable.id);

      this.logger.log(`Game Play Log ${gameTable.id} startGame`);
      await this.gameTimer.startGameTimer({
        tableId: gameTable.id,
        action: EPLGameAction.inningStart,
        delayInSeconds: 0,
      });
    } catch (error) {
      console.error('Error starting game:', error);
      throw error;
    }
  }

  private async checkAndHandleIsOut(tableId: string): Promise<boolean> {
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);

    if (gameTable.isOut) {
      gameTable.innings = gameTable.innings + 1;

      const batsman = gameTable.users.find((user) => user.role === 'batsman');
      if (batsman) {
        gameTable.targetScore = (Number(batsman.score) + 1).toString();
      } else {
        console.warn('No batsman found in the game table');
        gameTable.targetScore = '0'; // Default to 0 if no batsman is found
      }

      await this.gameTableRepository.storeGameTable(gameTable);
      await this.gameTimer.startGameTimer({
        tableId,
        action: EPLGameAction.inningStart,
        delayInSeconds: 0,
      });

      return true;
    }
    return false;
  }

  private async debitJoinFee(
    userIds: string[],
    joinFee: string,
    tableId: string,
  ) {
    await this.walletServiceGateway.debitEPLJoinFee(userIds, joinFee, tableId);
  }

  async handleBatBowlRequest(
    tableId: string,
    runs: number,
    userId: string,
    role: string,
  ) {
    const gameTable = await this.gameTableRepository.retrieveGameTable(tableId);

    const user = gameTable.users.find((user: any) => user.userId === userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== role) {
      if (role === 'batsman') {
        throw new BadRequestException('Bowler cannot send batting event!');
      } else if (role === 'bowler') {
        throw new BadRequestException('Batsman cannot send bowling event!');
      } else {
        throw new BadRequestException('Invalid role');
      }
    }

    user.runs = runs ?? 0;

    gameTable.isOut = await this.checkIfOut(gameTable.users);

    gameTable.batBowlAction = true;

    await this.gameTableRepository.storeGameTable(gameTable);

    await this.checkAndHandleIsOut(tableId);
  }

  private async checkIfOut(users: any[]): Promise<boolean> {
    const batsman = users.find((user: any) => user.role === 'batsman');
    const bowler = users.find((user: any) => user.role === 'bowler');
    return batsman && bowler && batsman.runs === bowler.runs;
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
      const maxPlayer = PLAYERS_PER_GAME;

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
              myPlayerId: leftPlayerId,
            },
          });
        } else {
          const myPlayerId = this.getWaitingPlayerId(
            newWaitingUsers,
            affectedUserId,
            maxPlayer,
          );

          this.eventEmitter.emit('socketEvent.leaveWaitingTable', {
            userId: affectedUserId,
            leaveWaitingTableResponse: {
              status: true,
              leftPlayerId,
              myPlayerId,
            },
          });
        }
      }
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableTypeId),
        this.lockerService.releaseLock(userId),
      ]);
      console.log(
        `Locks released for tableTypeId: ${tableTypeId} and userId: ${userId}`,
      );
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
    // Clone the array to avoid in-place modification
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

  public getRemainingPlayers(gameTable: EPLGameTable): UserEPLGameInfo[] {
    const remainingPlayers = gameTable.users.filter((user) => !user.didLeave);
    return remainingPlayers;
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
      const { id, users } = gameTable;
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
        gameTable.status = GameStatus.completed;
        await this.gameTableRepository.storeGameTable(gameTable);
        await this.handleGameEnded(id);
      }
      this.wss.in(userId).socketsLeave(tableId);
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableId),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }
}
