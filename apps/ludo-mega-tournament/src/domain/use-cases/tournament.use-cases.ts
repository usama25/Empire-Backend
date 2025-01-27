import * as dayjs from 'dayjs';
import * as Big from 'big.js';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as duration from 'dayjs/plugin/duration';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { LudoMegaTournamentEntity } from '@lib/fabzen-common/entities/ludo-mega-tournament.entity';
import {
  LudoMegaTournamentFilterWithPagination,
  LudoMegaTournamentStatus,
  Paginated,
} from '@lib/fabzen-common/types';

import {
  CreateLudoMegaTournamentDto,
  LeaderboardDto,
} from 'apps/rest-api/src/subroutes/ludo/mega-tournament/mega-tournament.dto';
import { LudoMegaTournamentHistoryDto } from 'apps/rest-api/src/subroutes/history/history.dto';
import { LudoMegaTournamentRepository } from '../interfaces/ludo-mega-tournament.repository';
import {
  ScheduleService,
  WalletServiceGateway,
  NotificationServiceGateway,
} from '../interfaces';
import { GetLeaderboardRequest } from '../../infrastructure/controllers/types';

dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class LudoMegaTournamentUseCases {
  private readonly logger = new Logger(LudoMegaTournamentUseCases.name);

  constructor(
    private readonly tournamentRepository: LudoMegaTournamentRepository,
    private readonly scheduleService: ScheduleService,
    private readonly walletServiceGateway: WalletServiceGateway,
    private readonly notificationServiceGateway: NotificationServiceGateway,
  ) {}

  async createLudoMegaTournament(
    createLudoMegaTournamentDto: CreateLudoMegaTournamentDto,
  ): Promise<string> {
    this.#validateTournamentCreationRequest(createLudoMegaTournamentDto);
    const tournament = await this.tournamentRepository.createLudoMegaTournament(
      createLudoMegaTournamentDto,
    );
    const { id, endAt } = tournament;
    this.scheduleService.scheduleTournamentEnd(id, endAt.toISOString());
    return id;
  }

  #validateTournamentCreationRequest(
    createLudoMegaTournamentDto: CreateLudoMegaTournamentDto,
  ) {
    const {
      joinFee,
      winningPrizes,
      maxTotalEntries,
      maxEntriesPerUser,
      endAt,
      extensionTime,
      maxExtensionLimit,
      totalMoves,
    } = createLudoMegaTournamentDto;

    if (Number(joinFee) <= 0) {
      throw new BadRequestException('Join fee cannot be negative');
    }

    if (Number(totalMoves) <= 0) {
      throw new BadRequestException('totalMoves cannot be negative');
    }

    if (winningPrizes.length === 0) {
      throw new BadRequestException('Winning prizes cannot be empty');
    }

    if (maxTotalEntries < 2) {
      throw new BadRequestException('Max total entries should be at least 2');
    }

    if (maxEntriesPerUser < 1) {
      throw new BadRequestException(
        'Max entries per user should be at least 1',
      );
    }

    if (dayjs().isAfter(endAt)) {
      throw new BadRequestException('End time should be in the future');
    }

    if (extensionTime <= 30) {
      throw new BadRequestException(
        'Extension time should be longer than 30 seconds',
      );
    }

    if (maxExtensionLimit < 0) {
      throw new BadRequestException('Max extension limit cannot be negative');
    }
  }

  async getTournamentById(
    tournamentId: string,
    userId: string,
  ): Promise<LudoMegaTournamentEntity> {
    return await this.tournamentRepository.getTournamentById(
      tournamentId,
      userId,
    );
  }

  async getTournaments(
    filter: LudoMegaTournamentFilterWithPagination,
  ): Promise<Paginated<LudoMegaTournamentEntity>> {
    return await this.tournamentRepository.getTournaments(filter);
  }

  async getLeaderboard(
    request: GetLeaderboardRequest,
  ): Promise<LeaderboardDto> {
    return await this.tournamentRepository.getLeaderboard(request);
  }

  async incrementEnteredUserCount(tournament: LudoMegaTournamentEntity) {
    tournament.enteredUserCount++;
    await this.tournamentRepository.incrementEnteredUserCount(tournament.id);
  }

  async handleFullTournament(tournament: LudoMegaTournamentEntity) {
    const { id, isRepeatable } = tournament;
    await this.tournamentRepository.updateTournament(id, {
      status: LudoMegaTournamentStatus.full,
    });
    if (isRepeatable) {
      await this.#repeatTournament(tournament);
    }
  }

  async finalizeIfAllGamesCompleted(tournament: LudoMegaTournamentEntity) {
    const { id, enteredUserCount } = tournament;
    if (!tournament.readyToFinalize()) {
      return;
    }
    const completedGamesCount =
      await this.tournamentRepository.getLeaderboardEntryCount(id);

    if (enteredUserCount === completedGamesCount) {
      await this.#finalizeTournament(tournament);
    }
  }

  async closeTournament(tournamentId: string) {
    const tournament =
      await this.tournamentRepository.getTournamentById(tournamentId);
    if (!tournament.shouldBeExtended()) {
      return;
    }
    if (tournament.canBeExtended()) {
      await this.#extendTournament(tournament);
    } else {
      this.logger.log(`Closing tournament ${tournamentId}`);
      await this.#doCloseTournament(tournament);
      await this.finalizeIfAllGamesCompleted(tournament);
    }
  }

  async #extendTournament(tournament: LudoMegaTournamentEntity) {
    const { id, extensionTime, extendedCount } = tournament;
    const nextEndAt = dayjs().add(extensionTime, 'seconds');
    this.scheduleService.scheduleTournamentEnd(id, nextEndAt.toISOString());
    await this.tournamentRepository.updateTournament(id, {
      extendedCount: extendedCount + 1,
      endAt: nextEndAt,
    });
  }

  async #doCloseTournament(tournament: LudoMegaTournamentEntity) {
    const { id } = tournament;
    tournament.status = LudoMegaTournamentStatus.closed;
    await this.tournamentRepository.updateTournament(id, {
      status: LudoMegaTournamentStatus.closed,
    });
  }

  async #repeatTournament(tournament: LudoMegaTournamentEntity) {
    const {
      alias,
      joinFee,
      winningPrizes,
      maxTotalEntries,
      maxEntriesPerUser,
      endAt,
      extensionTime,
      maxExtensionLimit,
      isRepeatable,
      useSamePawnPositions,
      totalMoves,
    } = tournament;

    const durationInSeconds = dayjs().diff(dayjs(endAt), 'seconds');
    const repeatedEndAt = dayjs().add(durationInSeconds, 'seconds');

    const nameSuffix = dayjs().tz('Asia/Kolkata').format('hh:mm A');
    const repeatedName = `${alias} ${nameSuffix}`;

    const createLudoMegaTournamentDto: CreateLudoMegaTournamentDto = {
      name: repeatedName,
      alias,
      joinFee,
      winningPrizes,
      maxTotalEntries,
      maxEntriesPerUser,
      endAt: repeatedEndAt.toDate(),
      extensionTime,
      maxExtensionLimit,
      isRepeatable,
      useSamePawnPositions,
      totalMoves,
    };

    await this.createLudoMegaTournament(createLudoMegaTournamentDto);
  }

  async #finalizeTournament(tournament: LudoMegaTournamentEntity) {
    const { id } = tournament;
    await this.tournamentRepository.updateLeaderboard(id);
    const prizes = await this.tournamentRepository.getPrizes(id);
    await this.walletServiceGateway.creditLudoMegaTournamentPrizes(id, prizes);
    let totalWinAmount = Big(0);
    for (const { winAmount } of prizes) {
      totalWinAmount = totalWinAmount.add(winAmount);
    }

    await this.tournamentRepository.markAsCompleted(
      id,
      totalWinAmount.toFixed(2),
    );
  }

  async cancelTournament(tournamentId: string) {
    const tournament =
      await this.tournamentRepository.getTournamentById(tournamentId);
    if (!tournament.canBeCanceled()) {
      return;
    }
    await this.tournamentRepository.updateTournament(tournamentId, {
      status: LudoMegaTournamentStatus.canceled,
      endAt: dayjs(),
    });
    await this.walletServiceGateway.refundTournamentJoinFees(tournamentId);
    const userIds =
      await this.tournamentRepository.getJoinedUserIds(tournamentId);
    await this.notificationServiceGateway.sendPushNotification(
      userIds,
      tournament.name,
      'The tournament has been canceled. Your refund amount will be credited to your wallet shortly.',
      'emp://ludoMegaTournament',
    );
  }

  async getLudoMegaTournamentHistory(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<Paginated<LudoMegaTournamentHistoryDto>> {
    return await this.tournamentRepository.getLudoMegaTournamentHistory(
      userId,
      skip,
      limit,
    );
  }
}
