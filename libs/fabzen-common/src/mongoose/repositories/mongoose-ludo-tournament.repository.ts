import * as dayjs from 'dayjs';
import * as duration from 'dayjs/plugin/duration';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LudoTournament,
  LudoTournamentDocument,
} from '../models/ludo-tournament.schema';
import {
  TournamentDTO,
  TournamentStatus,
} from 'apps/ludo-tournament/src/ludo-tournament.types';
import {
  calculateTotalAmount,
  calculateWinnerCount,
} from 'apps/ludo-tournament/src/ludo-tournament.utils';
import { chain } from 'lodash';
import {
  LudoTournamentPlayer,
  LudoTournamentPlayerDocument,
} from '../models/ludo-tournament-player.schema';
import { getRoundDuration } from 'apps/ludo-gameplay/src/utils/ludo-gameplay.utils';
import { config } from '@lib/fabzen-common/configuration';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import {
  TournamentInfoForPushNotification,
  TournamentInfoForSocketNotification,
} from 'apps/notification/src/notification.types';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { convertUtcToIst } from '@lib/fabzen-common/utils/time.utils';

dayjs.extend(duration);

Injectable();
export class MongooseLudoTournamentRepository {
  constructor(
    @InjectModel(LudoTournament.name)
    private ludoTournamentModel: Model<LudoTournamentDocument>,
    @InjectModel(LudoTournamentPlayer.name)
    private ludoTournamentPlayerModel: Model<LudoTournamentPlayerDocument>,
    private readonly userRepository: UserRepository,
  ) {}

  async getTournament(tournamentId: string): Promise<TournamentDTO> {
    const tournament = await this.ludoTournamentModel.findById(tournamentId);
    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }
    const tournamentDTO = await this.fromTournamentDoc(tournament);

    const { noPlayersPerGame, startAt, status } = tournamentDTO;
    const { duration, unit } = getRoundDuration(noPlayersPerGame);

    if (status === TournamentStatus.started) {
      const durationOfOneRound = dayjs
        .duration(config.ludoGameplay.tournamentRoundWaitingTime, 'seconds')
        .add(duration, unit as dayjs.ManipulateType)
        .add(config.ludoGameplay.bingoScreenWaitingTime, 'seconds')
        .asSeconds();

      const elapsedDuration = dayjs
        .duration(dayjs().diff(dayjs(startAt)))
        .asSeconds();

      const modifiedCurrentRoundNo = Math.ceil(
        elapsedDuration / durationOfOneRound,
      );

      tournamentDTO.currentRoundNo = modifiedCurrentRoundNo;
    }

    const canPlay = false;
    return { ...tournamentDTO, canPlay };
  }

  async bulkUpdatePlayers(bulkWriteOps: any[]) {
    await this.ludoTournamentPlayerModel.bulkWrite(bulkWriteOps, {
      ordered: false,
    });
  }

  async fromTournamentDoc(
    tournamentDocument: LudoTournamentDocument,
  ): Promise<TournamentDTO> {
    const {
      _id,
      maxNoPlayers,
      joinFee,
      winningPrizes,
      registerTill,
      createdAt,
      isAutomatic,
    } = tournamentDocument;

    const tournamentId = _id.toString();
    const [noJoinedPlayers, remainingUsers] = await Promise.all([
      this.getNoJoinedPlayers(tournamentId),
      this.getNoRemainingPlayers(tournamentId),
    ]);

    const tournamentDto: TournamentDTO = chain(tournamentDocument)
      .pick([
        'name',
        'alias',
        'joinFee',
        'status',
        'startAt',
        'endAt',
        'registerTill',
        'winningPrizes',
        'maxNoPlayers',
        'minNoPlayers',
        'noPlayersPerGame',
        'isRepeatable',
        'isActive',
        'isDeleted',
        'totalRounds',
        'currentRoundNo',
        'dynamicLink',
        'featured',
      ])
      .assign({
        id: tournamentId,
        winnerCount: calculateWinnerCount(winningPrizes),
        totalAmount: calculateTotalAmount(
          joinFee,
          maxNoPlayers,
          winningPrizes,
          registerTill,
        ),
        noJoinedPlayers,
        remainingUsers,
        createdAt,
        isAutomatic: !!isAutomatic,
      })
      .value();

    return tournamentDto;
  }

  async getNoJoinedPlayers(tournamentId: string): Promise<number> {
    return this.ludoTournamentPlayerModel.countDocuments({
      tournamentId: toObjectId(tournamentId),
    });
  }

  async getNoRemainingPlayers(tournamentId: string): Promise<number> {
    return this.ludoTournamentPlayerModel.countDocuments({
      tournamentId: toObjectId(tournamentId),
      lostRoundNo: 0,
    });
  }

  async getTournamentUserIds(tournamentId: string): Promise<string[]> {
    const players = await this.ludoTournamentPlayerModel
      .find({ tournamentId: toObjectId(tournamentId) }, { _id: 0, userId: 1 })
      .lean();
    return players.map(({ userId }) => userId.toString());
  }

  async getTournamentJoinFee(tournamentId: string): Promise<string> {
    const tournament = await this.ludoTournamentModel.findById(tournamentId, {
      _id: 0,
      joinFee: 1,
    });
    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }
    return tournament.joinFee;
  }

  async getTournamentInfoForPushNotification(
    tournamentId: string,
  ): Promise<TournamentInfoForPushNotification> {
    const [tournament, userIds] = await Promise.all([
      this.ludoTournamentModel.findById(tournamentId, {
        _id: 0,
        name: 1,
        startAt: 1,
      }),
      this.getTournamentUserIds(tournamentId),
    ]);
    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }

    const { name, startAt } = tournament;
    const users =
      await this.userRepository.getUserDetailsForNotification(userIds);
    return {
      id: tournamentId,
      name,
      startAt: dayjs(startAt).toISOString(),
      users,
    };
  }

  async getTournamentInfoForSocketNotification(
    tournamentId: string,
  ): Promise<TournamentInfoForSocketNotification> {
    const [tournament, userIds] = await Promise.all([
      this.ludoTournamentModel.findById(tournamentId, {
        _id: 0,
        name: 1,
        startAt: 1,
      }),
      this.getTournamentUserIds(tournamentId),
    ]);
    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }

    const { name, startAt } = tournament;
    return {
      tournamentId,
      name,
      startAt: convertUtcToIst(startAt),
      userIds,
    };
  }
}
