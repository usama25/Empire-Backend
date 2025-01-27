import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PlayerId, UserID } from '@lib/fabzen-common/types';
import { LockerService } from '@lib/fabzen-common/locker/locker.service';

import {
  LudoMegaTournamentGameTableRepository,
  LudoMegaTournamentRepository,
  WalletServiceGateway,
} from '../interfaces';
import {
  GameAction,
  LudoMegaTournamentGameTable,
  INITIAL_LIVES,
  NEXT_ACTION_DELAY_IN_SECONDS,
  BONUS_PER_HOME_LANDING,
  REMAINING_MOVES_BONUS_ANIMATION_TIME_IN_SECONDS,
  HOME_LANDING_DELAY_IN_SECONDS,
  BONUS_PER_REMAINING_MOVE,
  PawnPosition,
} from '../entities';
import {
  EndGameEvent,
  GameEvent,
  GameStartInfo,
  GameStatus,
  LudoMegaTournamentGameTimerUseCases,
  LudoMegaTournamentUseCases,
  MovePawnResponseEvent,
  NextActionEvent,
  ReconnectionData,
} from './';
import { MovePawnRequest } from '../../infrastructure/controllers';
import { LudoMegaTournamentRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

@Injectable()
export class LudoMegaTournamentGameplayUseCases {
  private readonly logger = new Logger(LudoMegaTournamentGameplayUseCases.name);

  constructor(
    private readonly tournamentRepository: LudoMegaTournamentRepository,
    private readonly walletServiceGateway: WalletServiceGateway,
    private readonly gameTableRepository: LudoMegaTournamentGameTableRepository,
    private readonly lockerService: LockerService,
    @Inject(forwardRef(() => LudoMegaTournamentGameTimerUseCases))
    private readonly gameTimerUseCases: LudoMegaTournamentGameTimerUseCases,
    @Inject(forwardRef(() => LudoMegaTournamentUseCases))
    private readonly tournamentUseCases: LudoMegaTournamentUseCases,
    private readonly configService: LudoMegaTournamentRemoteConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getReconnectionData(userId: string): Promise<ReconnectionData> {
    const activeTable =
      await this.gameTableRepository.retrieveUserActiveTable(userId);
    if (!activeTable) {
      return {
        isReconnected: false,
        status: GameStatus.completed,
      };
    }

    const tableInfo = activeTable.toReconnectionData();
    const {
      action,
      dices,
      timeout,
      canMovePawns,
      score,
      tournamentId,
      ...rest
    } = tableInfo;
    const tournament = await this.tournamentRepository.getTournamentById(
      tournamentId,
      userId,
    );
    const {
      id,
      name,
      joinFee,
      maxTotalEntries,
      maxEntriesPerUser,
      totalPrizePool,
      myEntryCount,
      myHighestScore,
      highestScore,
      endAt,
      status,
      winningPrizes,
    } = tournament;
    return {
      isReconnected: true,
      status: GameStatus.started,
      action,
      dices,
      timeout,
      canMovePawns,
      score,
      tableInfo: {
        joinFee,
        homeBonus: BONUS_PER_HOME_LANDING,
        ...rest,
      },
      tournamentData: {
        id,
        name,
        joinFee,
        maxTotalEntries,
        maxEntriesPerUser,
        totalPrizePool,
        myEntryCount,
        myHighestScore,
        highestScore,
        endAt,
        status,
        winningPrizes,
      },
    };
  }

  async forceReconnect(
    userId: string,
    tableId: string,
  ): Promise<ReconnectionData> {
    const normalReconnectionData = await this.getReconnectionData(userId);
    if (normalReconnectionData.isReconnected) {
      return normalReconnectionData;
    }
    const { tournamentId, score } =
      await this.tournamentRepository.getFinishedGameInfo(tableId);
    const [{ maxEntriesPerUser, highestScore }, entryCount, rank] =
      await Promise.all([
        this.tournamentRepository.getTournamentById(tournamentId, userId),
        this.tournamentRepository.getUserEntryCount(tournamentId, userId),
        this.tournamentRepository.getRankWithScore(tournamentId, score),
      ]);
    const gameResult: EndGameEvent = {
      tableId,
      score,
      highestScore,
      entriesLeft: maxEntriesPerUser - entryCount,
      rank,
    };
    return {
      isReconnected: true,
      status: GameStatus.completed,
      gameResult,
    };
  }

  async checkIfReconnected(userId: string): Promise<boolean> {
    const activeTableId =
      await this.gameTableRepository.retrieveUserActiveTableId(userId);
    return !!activeTableId;
  }

  async handlePlayRequest(
    userId: UserID,
    tournamentId: string,
  ): Promise<GameStartInfo> {
    this.logger.log(
      `User ${userId} joins Ludo Mega Tournament ${tournamentId}`,
    );

    await Promise.all([
      this.lockerService.acquireLock(`${tournamentId}-join`),
      this.lockerService.acquireLock(userId),
    ]);

    try {
      const [tournament, entryCount] = await Promise.all([
        this.tournamentRepository.getTournamentById(tournamentId, userId),
        this.tournamentRepository.getUserEntryCount(tournamentId, userId),
      ]);
      const { joinFee, useSamePawnPositions, pawnPositions } = tournament;
      tournament.checkIfJoinable(entryCount);

      await this.debitJoinFee(userId, joinFee, tournamentId, entryCount);

      let initialPawnPositions: PawnPosition[] = [];
      initialPawnPositions =
        !useSamePawnPositions || pawnPositions.length === 0
          ? LudoMegaTournamentGameTable.getRandomInitialPositions()
          : pawnPositions;

      if (useSamePawnPositions && pawnPositions.length === 0) {
        // Store initial positions for next users
        await this.tournamentRepository.updateTournament(tournamentId, {
          pawnPositions: initialPawnPositions,
        });
      }

      await this.tournamentUseCases.incrementEnteredUserCount(tournament);
      if (tournament.isFull()) {
        await this.tournamentUseCases.handleFullTournament(tournament);
      }

      // Prepare the game table
      const totalMoves = tournament.totalMoves;
      const gameTable = LudoMegaTournamentGameTable.create(
        tournamentId,
        userId,
        totalMoves,
        initialPawnPositions,
      );
      await this.gameTableRepository.storeGameTable(gameTable, true);
      await this.gameTimerUseCases.startGameTimer({
        tableId: gameTable.id,
        action: GameAction.startGame,
        targetCounter: gameTable.counter + 1,
      });

      return {
        tableId: gameTable.id,
        pawnPositions: gameTable.getPawnPositions(),
        myPlayerId: PlayerId.pl1,
        totalMoves,
        lives: INITIAL_LIVES,
        homeBonus: BONUS_PER_HOME_LANDING,
      };
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(`${tournamentId}-join`),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }

  async handleReadyToStart(
    tableId: string,
  ): Promise<NextActionEvent | undefined> {
    this.logger.log(`Game Log ${tableId} readyToStart`);

    await this.lockerService.acquireLock(tableId);

    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      if (gameTable.alreadyStarted()) {
        return;
      }
      gameTable.incrementCounterAndTimeout();
      const nextAction = gameTable.generateNextAction();
      this.gameTimerUseCases.startGameTimer({
        tableId,
        action: GameAction.skipTurn,
        targetCounter: gameTable.counter + 1,
      });
      await this.gameTableRepository.storeGameTable(gameTable);
      return nextAction;
    } finally {
      await this.lockerService.releaseLock(tableId);
    }
  }

  async handleRollDice(tableId: string, userId: string): Promise<number> {
    this.logger.log(`Game Log ${tableId} rollDice ${userId}`);

    await Promise.all([
      this.lockerService.acquireLock(tableId),
      this.lockerService.acquireLock(userId),
    ]);

    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      const { dice, skippedMove } = gameTable.rollDice(
        this.configService.isExtraRollAfterSixEnabled(),
      );
      await this.gameTableRepository.storeGameTable(gameTable);

      if (skippedMove) {
        this.eventEmitter.emit('socketEvent.movePawnRes', skippedMove);
      }

      if (gameTable.shouldEndGame()) {
        setTimeout(() => {
          this.handleEndGame(tableId);
        }, NEXT_ACTION_DELAY_IN_SECONDS * 1000);
      } else {
        const nextAction = gameTable.generateNextAction();
        this.gameTimerUseCases.startGameTimer({
          tableId,
          action: GameAction.skipTurn,
          targetCounter: gameTable.counter + 1,
        });
        setTimeout(() => {
          this.eventEmitter.emit('socketEvent.nextAction', nextAction);
        }, NEXT_ACTION_DELAY_IN_SECONDS * 1000);
      }

      return dice;
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableId),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }

  async handleMovePawn(
    userId: string,
    movePawnRequest: MovePawnRequest,
  ): Promise<MovePawnResponseEvent> {
    const { tableId, pawn, dice } = movePawnRequest;
    this.logger.log(`Game Log ${tableId} movePawn ${pawn} ${dice}`);

    await Promise.all([
      this.lockerService.acquireLock(tableId),
      this.lockerService.acquireLock(userId),
    ]);

    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      const movePawnResponseEvent = gameTable.movePawn(pawn, dice);
      await this.gameTableRepository.storeGameTable(gameTable);
      if (gameTable.shouldEndGame()) {
        await this.handleEndGame(tableId);
      } else {
        const nextAction = gameTable.generateNextAction();
        this.gameTimerUseCases.startGameTimer({
          tableId,
          action: GameAction.skipTurn,
          targetCounter: gameTable.counter + 1,
        });
        setTimeout(() => {
          this.eventEmitter.emit('socketEvent.nextAction', nextAction);
        }, NEXT_ACTION_DELAY_IN_SECONDS * 1000);
      }

      return movePawnResponseEvent;
    } finally {
      await Promise.all([
        this.lockerService.releaseLock(tableId),
        this.lockerService.releaseLock(userId),
      ]);
    }
  }

  async handleSkipTurn(tableId: string) {
    this.logger.log(`Game Log ${tableId} skipTurn`);

    await Promise.all([this.lockerService.acquireLock(tableId)]);

    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      gameTable.skipTurn();
      if (gameTable.shouldEndGame()) {
        return this.handleEndGame(tableId);
      }
      const nextAction = gameTable.generateNextAction();
      this.gameTimerUseCases.startGameTimer({
        tableId,
        action: GameAction.skipTurn,
        targetCounter: gameTable.counter + 1,
      });
      await this.gameTableRepository.storeGameTable(gameTable);
      this.eventEmitter.emit('socketEvent.nextAction', nextAction);
    } finally {
      await Promise.all([this.lockerService.releaseLock(tableId)]);
    }
  }

  async handleEndGame(tableId: string) {
    this.logger.log(`Game Log ${tableId} endGame`);

    let tournamentIdToUnlock = '';
    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);

      let endGameEventDelay = NEXT_ACTION_DELAY_IN_SECONDS;
      if (gameTable.getHomePawnCount() === 4) {
        const bonus = gameTable.creditBonusForRemainingMoves();
        const { remainingMoves } = gameTable;
        setTimeout(() => {
          this.eventEmitter.emit('socketEvent.remainingMovesBonus', {
            tableId,
            bonus,
            remainingMoves,
            maxScorePerRemainingMove: BONUS_PER_REMAINING_MOVE,
          });
        }, HOME_LANDING_DELAY_IN_SECONDS * 1000);

        endGameEventDelay =
          REMAINING_MOVES_BONUS_ANIMATION_TIME_IN_SECONDS +
          HOME_LANDING_DELAY_IN_SECONDS;
      }
      const score = gameTable.calculateTotalScore();
      const { tournamentId, userId } = gameTable;
      tournamentIdToUnlock = tournamentId;
      await this.gameTableRepository.deleteGameTable(tableId, userId);
      await this.tournamentRepository.storeGameResult(
        tournamentId,
        userId,
        tableId,
        score,
      );
      const [tournament, entryCount, rank] = await Promise.all([
        this.tournamentRepository.getTournamentById(tournamentId),
        this.tournamentRepository.getUserEntryCount(tournamentId, userId),
        this.tournamentRepository.getRankWithScore(tournamentId, score),
      ]);

      const {
        maxEntriesPerUser,
        highestScore,
        enteredUserCount,
        maxTotalEntries,
      } = tournament;
      const endGameEvent: EndGameEvent = {
        tableId,
        score,
        highestScore,
        entriesLeft: Math.min(
          maxEntriesPerUser - entryCount,
          maxTotalEntries - enteredUserCount,
        ),
        rank,
      };

      setTimeout(() => {
        this.eventEmitter.emit('socketEvent.endGame', endGameEvent);
      }, endGameEventDelay * 1000);
      await this.lockerService.acquireLock(tournamentId);
      await this.tournamentUseCases.finalizeIfAllGamesCompleted(tournament);
    } finally {
      await Promise.all([this.lockerService.releaseLock(tournamentIdToUnlock)]);
    }
  }

  private async debitJoinFee(
    userId: UserID,
    joinFee: string,
    tournamentId: string,
    entryCount: number,
  ) {
    await this.walletServiceGateway.debitLudoMegaTournamentJoinFee(
      userId,
      joinFee,
      tournamentId,
      entryCount,
    );
  }

  public async getLastEvent(
    tableId: string,
    userId: string,
  ): Promise<GameEvent | undefined> {
    try {
      const gameTable =
        await this.gameTableRepository.retrieveGameTable(tableId);
      if (!gameTable) {
        console.error(`Game table not found for tableId: ${tableId}`);
        return;
      }

      return gameTable.alreadyStarted()
        ? this.getNextEvent(gameTable)
        : this.getReadyToStartEvent(tableId);
    } catch (error) {
      console.error(
        `Error retrieving last event for tableId: ${tableId}, userId: ${userId}`,
        error,
      );
      return this.handleGameFinished(tableId, userId);
    }
  }

  private async getNextEvent(
    gameTable: LudoMegaTournamentGameTable,
  ): Promise<GameEvent> {
    const eventName = 'next';
    const eventPayload = gameTable.generateNextAction();
    return { eventName, eventPayload };
  }

  private async getReadyToStartEvent(tableId: string): Promise<GameEvent> {
    const eventName = 'next';
    const eventPayload = await this.handleReadyToStart(tableId);
    return { eventName, eventPayload };
  }

  private async handleGameFinished(
    tableId: string,
    userId: string,
  ): Promise<GameEvent> {
    try {
      const { tournamentId, score } =
        await this.tournamentRepository.getFinishedGameInfo(tableId);
      const [{ maxEntriesPerUser, highestScore }, entryCount, rank] =
        await Promise.all([
          this.tournamentRepository.getTournamentById(tournamentId, userId),
          this.tournamentRepository.getUserEntryCount(tournamentId, userId),
          this.tournamentRepository.getRankWithScore(tournamentId, score),
        ]);

      const eventName = 'gameFinished';
      const eventPayload: EndGameEvent = {
        tableId,
        score,
        highestScore,
        entriesLeft: maxEntriesPerUser - entryCount,
        rank,
      };

      return { eventName, eventPayload };
    } catch (error) {
      console.error(
        `Error handling game finished for tableId: ${tableId}, userId: ${userId}`,
        error,
      );
      throw error; // Rethrow after logging or handle accordingly
    }
  }
}
