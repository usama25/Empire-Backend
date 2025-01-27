import { Controller, forwardRef, Inject, Logger } from '@nestjs/common';

import { LudoGameplayService } from './ludo-gameplay.service';
import {
  TableID,
  TournamentID,
  UserID,
  MovePawnRequest,
  RollDiceRequest,
  ReadyToStartRequest,
  SkipTurnRequest,
  LeaveTableRequest,
  JoinTableResponse,
  ReconnectResponse,
  ReconnectTournamentResponse,
  ForceReconnectGameResponse,
  PawnResponse,
  PlayerId,
} from './ludo-gameplay.types';
import { LudoGameplayGateway } from './ludo-gameplay.gateway';
import { WaitingTableQueueService } from './services/queue';
import { CommonService } from './services/gameplay';
import { RedisService } from './services/redis/service';
import { TournamentChangedEvent } from 'apps/ludo-tournament/src/ludo-tournament.types';
import { MongooseLudoTournamentRepository } from '@lib/fabzen-common/mongoose/repositories/mongoose-ludo-tournament.repository';

@Controller()
export class LudoGameplayController {
  isReady: Promise<boolean>;
  private readonly logger = new Logger(LudoGameplayController.name);

  constructor(
    @Inject(forwardRef(() => LudoGameplayService))
    private readonly ludoGameplayService: LudoGameplayService,
    @Inject(forwardRef(() => LudoGameplayGateway))
    private readonly ludoGameplayGateway: LudoGameplayGateway,
    @Inject(forwardRef(() => WaitingTableQueueService))
    private readonly waitingTableQueueService: WaitingTableQueueService,
    @Inject(forwardRef(() => CommonService))
    private commonService: CommonService,
    private readonly redisService: RedisService,
    private readonly ludoTournamentRepository: MongooseLudoTournamentRepository,
  ) {}

  async connected(userId: UserID): Promise<ReconnectResponse> {
    try {
      await this.redisService.aquireLock(userId);
      return this.ludoGameplayService.connected(userId);
    } finally {
      await this.redisService.releaseLock(userId);
    }
  }

  async forceReconnect(
    userId: UserID,
    tableID?: TableID,
  ): Promise<ForceReconnectGameResponse | ReconnectTournamentResponse> {
    return this.ludoGameplayService.forceReconnect(userId, tableID);
  }

  async forceReconnectTournament(
    tournamentId: TournamentID,
    userId: UserID,
  ): Promise<ReconnectTournamentResponse> {
    return this.ludoGameplayService.forceReconnectTournament(
      tournamentId,
      userId,
    );
  }

  async joinTable(userId: string, tableTypeId: string) {
    try {
      await this.redisService.aquireLock(userId);
      await this.ludoGameplayService.joinTable(userId, tableTypeId);
    } finally {
      await this.redisService.releaseLock(userId);
    }
  }

  async checkIfJoined(userId: UserID): Promise<JoinTableResponse | undefined> {
    return this.ludoGameplayService.checkIfJoined(userId);
  }

  async readyToStart(readyToStartRequest: ReadyToStartRequest) {
    const { userId, tableId } = readyToStartRequest;
    try {
      await Promise.all([
        this.redisService.aquireLock(userId),
        this.redisService.aquireLock(tableId),
      ]);
      await this.ludoGameplayService.readyToStart(readyToStartRequest);
    } finally {
      await Promise.all([
        this.redisService.releaseLock(userId),
        this.redisService.releaseLock(tableId),
      ]);
    }
  }

  async rollDice(rollDiceRequest: RollDiceRequest) {
    const { userId, tableId } = rollDiceRequest;
    try {
      await Promise.all([
        this.redisService.aquireLock(userId),
        this.redisService.aquireLock(tableId),
      ]);
      await this.ludoGameplayService.rollDice(rollDiceRequest);
    } finally {
      await Promise.all([
        this.redisService.releaseLock(userId),
        this.redisService.releaseLock(tableId),
      ]);
    }
  }

  async movePawn(
    movePawnRequest: MovePawnRequest,
  ): Promise<PawnResponse | undefined> {
    const { userId, tableId } = movePawnRequest;
    try {
      await Promise.all([
        this.redisService.aquireLock(userId),
        this.redisService.aquireLock(tableId),
      ]);
      const movePawnResponse =
        await this.ludoGameplayService.movePawn(movePawnRequest);
      if (!movePawnResponse) {
        return;
      }
      const { movedPawns, scores } = movePawnResponse;

      return { movedPawns, scores };
    } finally {
      await Promise.all([
        this.redisService.releaseLock(userId),
        this.redisService.releaseLock(tableId),
      ]);
    }
  }

  async skipTurn(skipTurnRequest: SkipTurnRequest) {
    const { userId, tableId } = skipTurnRequest;
    try {
      await Promise.all([
        this.redisService.aquireLock(userId),
        this.redisService.aquireLock(tableId),
      ]);
      await this.ludoGameplayService.skipTurn(skipTurnRequest);
    } finally {
      await Promise.all([
        this.redisService.releaseLock(userId),
        this.redisService.releaseLock(tableId),
      ]);
    }
  }

  async leaveTable(leaveTableRequest: LeaveTableRequest) {
    const { userId, tableId } = leaveTableRequest;
    try {
      await Promise.all([
        this.redisService.aquireLock(userId),
        this.redisService.aquireLock(tableId),
      ]);
      await this.ludoGameplayService.leaveTable(leaveTableRequest);
    } finally {
      await Promise.all([
        this.redisService.releaseLock(userId),
        this.redisService.releaseLock(tableId),
      ]);
    }
  }

  async leaveWaitingTable(userId: UserID) {
    try {
      await this.redisService.aquireLock(userId);
      await this.ludoGameplayService.leaveWaitingTable(userId);
    } finally {
      await this.redisService.releaseLock(userId);
    }
  }

  async endGame(tableId: string) {
    try {
      await this.redisService.aquireLock(tableId);
      await this.ludoGameplayService.endGame(tableId);
    } finally {
      await this.redisService.releaseLock(tableId);
    }
  }

  async endRound(
    tournamentId: string,
    roundNo: number,
    tableId: string | undefined,
  ) {
    await (tableId
      ? this.ludoGameplayService.endSomeRoundGamesEarlier(tableId)
      : this.ludoGameplayService.endRound(tournamentId, roundNo));
  }

  async getLeftPlayerList(tableId: TableID | undefined): Promise<PlayerId[]> {
    return this.ludoGameplayService.getLeftPlayerList(tableId);
  }

  async ignoreTournament(tournamentId: TournamentID, userId: UserID) {
    this.commonService.makeTournamentLoser(tournamentId, userId);
  }

  async tournamentChanged(tournamentChangedEvent: TournamentChangedEvent) {
    this.ludoGameplayGateway.tournamentChanged(tournamentChangedEvent);
  }

  async matchNormalGames(shouldBroadcastTableList: boolean) {
    this.waitingTableQueueService.matchAllTypes(shouldBroadcastTableList);
  }

  async tournamentCanceled(tournamentId: string, reason: string) {
    const userIds =
      await this.ludoTournamentRepository.getTournamentUserIds(tournamentId);
    this.ludoGameplayGateway.tournamentForceTerminated({
      tournamentId,
      userIds,
      reason,
    });
  }
}
