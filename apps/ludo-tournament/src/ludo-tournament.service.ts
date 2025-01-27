import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as duration from 'dayjs/plugin/duration';
import { Model, ObjectId } from 'mongoose';
import Big from 'big.js';
import { InjectModel } from '@nestjs/mongoose';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  TournamentStatus,
  WinningPrize,
  PrizeCredit,
  RoundEndResponse,
  RoundEndResult,
  TournamentChangedEvent,
  TournamentDTO,
  FirebaseDynamicLinkRequest,
  TournamentTerminationData,
  TournamentFilterWithPagination,
  GetLeaderboardRequest,
  RoundInfo,
  RoundResult,
  CheckIfFinishedResult,
  UserTournamentStatus,
  UserRank,
} from './ludo-tournament.types';

import { getRoundDuration } from 'apps/ludo-gameplay/src/utils/ludo-gameplay.utils';
import { RedisTransientDBService } from 'apps/ludo-gameplay/src/services/transient-db/redis-backend';

import {
  calculateRoundStartTime,
  calculateTotalRounds,
  calculateWinAmount,
} from './ludo-tournament.utils';
import { MongooseLudoTournamentRepository } from '@lib/fabzen-common/mongoose/repositories/mongoose-ludo-tournament.repository';
import {
  LudoTournament,
  LudoTournamentDocument,
} from '@lib/fabzen-common/mongoose/models/ludo-tournament.schema';
import {
  LudoTournamentPlayer,
  LudoTournamentPlayerDocument,
} from '@lib/fabzen-common/mongoose/models/ludo-tournament-player.schema';
import {
  LudoTournamentLeaderboard,
  LudoTournamentLeaderboardDocument,
} from '@lib/fabzen-common/mongoose/models/ludo-tournament-leaderboard.schema';
import { TransporterProviders } from '@lib/fabzen-common/types';
import { ClientProxy } from '@nestjs/microservices';
import { WalletProvider } from 'apps/wallet/src/wallet.provider';
import { LudoGameplayProvider } from 'apps/ludo-gameplay/src/ludo-gameplay.provider';
import { config } from '@lib/fabzen-common/configuration';
import { SchedulerProvider } from 'apps/scheduler/src/scheduler.provider';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
} from 'apps/rest-api/src/subroutes/ludo/tournament/tournament.dto';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { RedisService } from 'apps/ludo-gameplay/src/services/redis/service';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { LudoRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class LudoTournamentService {
  private readonly logger = new Logger(LudoTournamentService.name);
  private readonly walletProvider: WalletProvider;
  private readonly ludoGameplayProvider: LudoGameplayProvider;
  private readonly schedulerProvider: SchedulerProvider;

  constructor(
    private readonly redisService: RedisService,
    private readonly transientDBService: RedisTransientDBService,
    private readonly ludoTournamentRepository: MongooseLudoTournamentRepository,
    @InjectModel(LudoTournament.name)
    private tournamentModel: Model<LudoTournamentDocument>,
    @InjectModel(LudoTournamentPlayer.name)
    private tournamentPlayerModel: Model<LudoTournamentPlayerDocument>,
    @InjectModel(LudoTournamentLeaderboard.name)
    private tournamentLeaderboardModel: Model<LudoTournamentLeaderboardDocument>,
    @Inject(TransporterProviders.WALLET_SERVICE)
    private walletClient: ClientProxy,
    @Inject(TransporterProviders.LUDO_GAMEPLAY_SERVICE)
    private ludoGameplayClient: ClientProxy,
    @Inject(TransporterProviders.SCHEDULER_SERVICE)
    private schedulerClient: ClientProxy,
    private readonly configService: RemoteConfigService,
    private readonly ludoRemoteConfig: LudoRemoteConfigService,
    private readonly httpClientService: HttpClientService,
    private readonly userRepository: UserRepository,
  ) {
    this.walletProvider = new WalletProvider(this.walletClient);
    this.ludoGameplayProvider = new LudoGameplayProvider(
      this.ludoGameplayClient,
    );
    this.schedulerProvider = new SchedulerProvider(this.schedulerClient);
  }

  async endSomeRoundGamesEarlier(
    tournamentId: string,
    roundNo: number,
    roundEndResults: RoundEndResult[],
  ): Promise<RoundEndResponse | undefined> {
    try {
      const tournament = await this.tournamentModel.findById(tournamentId);
      if (!tournament || tournament.status !== TournamentStatus.started) {
        const errorMessage = `Tournament ${tournamentId} is not Found or Active`;
        this.logger.warn(errorMessage);
        throw new InternalServerErrorException(errorMessage);
      }
      const { currentRoundNo, totalRounds } = tournament;

      if (roundNo !== currentRoundNo) {
        const errorMessage = `Tournament ${tournamentId} Round ${roundNo} result is already declared`;
        this.logger.warn(errorMessage);
        throw new InternalServerErrorException(errorMessage);
      }

      const bulkWriteOps: any[] = [];

      for (const roundEndResult of roundEndResults) {
        const {
          tableId,
          winners,
          scores,
          players: playersOfRound,
        } = roundEndResult;

        for (const { userId, playerId } of playersOfRound) {
          const score = scores[playerId] ?? 0;
          bulkWriteOps.push({
            updateOne: {
              filter: {
                tournamentId: toObjectId(tournamentId),
                userId: toObjectId(userId),
              },
              update: {
                $push: {
                  rounds: {
                    tableId,
                    roundNo: currentRoundNo,
                    score: score,
                  },
                },
                $set: {
                  lastPlayedRoundNo: currentRoundNo,
                  lastRoundScore: score,
                  ...(winners.includes(playerId)
                    ? {}
                    : { lostRoundNo: currentRoundNo }),
                },
              },
            },
          });
          if (!winners.includes(playerId)) {
            this.transientDBService.deleteUserTournamentId(userId);
          }
        }
      }

      await this.tournamentPlayerModel.bulkWrite(bulkWriteOps, {
        ordered: false,
      });

      const noRemainingPlayers =
        await this.ludoTournamentRepository.getNoRemainingPlayers(tournamentId);
      if (currentRoundNo === totalRounds || noRemainingPlayers <= 1) {
        return this.endRound(tournamentId, roundNo, roundEndResults);
      }
    } catch (error) {
      this.logger.error('Error Occured during Round End handling');
      this.logger.error(error);
      throw error;
    }
  }

  async endRound(
    tournamentId: string,
    roundNo: number,
    roundEndResults: RoundEndResult[],
  ): Promise<RoundEndResponse> {
    try {
      const tournament = await this.tournamentModel.findById(tournamentId);
      if (!tournament || tournament.status !== TournamentStatus.started) {
        const errorMessage = `Tournament ${tournamentId} is not Found or Active`;
        this.logger.warn(errorMessage);
        throw new InternalServerErrorException(errorMessage);
      }
      const {
        name: tournamentName,
        currentRoundNo,
        noPlayersPerGame,
        totalRounds,
        winningPrizes,
      } = tournament;

      if (roundNo !== currentRoundNo) {
        const errorMessage = `Tournament ${tournamentId} Round ${roundNo} result is already declared`;
        this.logger.warn(errorMessage);
        throw new InternalServerErrorException(errorMessage);
      }

      // User IDs who are waiting for the tournament end result
      const responseRecipients: string[] = [];

      const userIds: string[] = [];
      const promotedUserIds = [];
      const updatedPlayersObject: any = {};
      const bulkWriteOps: any[] = [];

      for (const roundEndResult of roundEndResults) {
        const {
          tableId,
          winners,
          scores,
          players: playersOfRound,
        } = roundEndResult;

        for (const { userId, playerId } of playersOfRound) {
          const score = scores[playerId] ?? 0;
          userIds.push(userId);
          updatedPlayersObject[userId] = {
            lastRoundScore: score,
            lastPlayedRoundNo: currentRoundNo,
            lostRoundNo: winners.includes(playerId) ? 0 : currentRoundNo,
          };
          bulkWriteOps.push({
            updateOne: {
              filter: {
                tournamentId: toObjectId(tournamentId),
                userId: toObjectId(userId),
                lastPlayedRoundNo: { $ne: currentRoundNo },
              },
              update: {
                $push: {
                  rounds: {
                    tableId,
                    roundNo: currentRoundNo,
                    score: score,
                  },
                },
                $set: {
                  lastPlayedRoundNo: currentRoundNo,
                  lastRoundScore: score,
                  ...(winners.includes(playerId)
                    ? {}
                    : { lostRoundNo: currentRoundNo }),
                },
              },
            },
          });
          if (winners.includes(playerId)) {
            promotedUserIds.push(userId);
          } else {
            this.transientDBService.deleteUserTournamentId(userId);
          }
        }
      }

      const players = await this.tournamentPlayerModel
        .find(
          {
            tournamentId: toObjectId(tournamentId),
          },
          { _id: 0, rounds: 0, createdAt: 0, updatedAt: 0, __v: 0 },
        )
        .lean();

      for (const player of players) {
        const updatedPlayer = updatedPlayersObject[player.userId.toString()];
        if (updatedPlayer) {
          player.lastPlayedRoundNo = updatedPlayer.lastPlayedRoundNo;
          player.lastRoundScore = updatedPlayer.lastRoundScore;
          player.lostRoundNo = updatedPlayer.lostRoundNo;
        }
      }

      let roundEndResponse: RoundEndResponse = {
        finished: false,
        tournamentId,
        responseRecipients,
      };

      const noRemainingPlayers = players.filter(
        ({ lostRoundNo }) => lostRoundNo === 0,
      ).length;

      // Generate leaderboard for the losers of the round
      const leaderboardForLosersPromise =
        this.generateLeaderBoardAndCreditWinAmount(
          tournamentId,
          players,
          currentRoundNo,
          winningPrizes,
          false,
        );

      if (currentRoundNo === totalRounds || noRemainingPlayers <= 1) {
        // Generate leaderboard for the winner

        await leaderboardForLosersPromise;
        await this.generateLeaderBoardAndCreditWinAmount(
          tournamentId,
          players,
          currentRoundNo,
          winningPrizes,
          true,
        );
        const lastRoundLeaderboard = (await this.tournamentLeaderboardModel
          .find(
            {
              tournamentId,
              roundNo: currentRoundNo,
            },
            {
              _id: 0,
              rank: 1,
              prize: '$winAmount',
              userId: 1,
            },
          )
          .lean()) as {
          userId: string;
          rank: number;
          prize: string;
        }[];

        roundEndResponse = {
          finished: true,
          tournamentId,
          tournamentName,
          responseRecipients: [], // not needed because leaderboard data will be used
          lastRoundLeaderboard,
          noPlayersPerGame,
        };
        tournament.isActive = false;
        tournament.status = TournamentStatus.ended;
        tournament.endAt = dayjs().toDate();
      } else {
        // Update total rounds
        const remainingRounds = calculateTotalRounds(
          noRemainingPlayers,
          noPlayersPerGame,
        );
        const potentiallyChangedTotalRounds = currentRoundNo + remainingRounds;
        if (potentiallyChangedTotalRounds !== totalRounds) {
          tournament.totalRounds = potentiallyChangedTotalRounds;
          const tournamentChangedEvent: TournamentChangedEvent = {
            tournamentId,
            joinedPlayer: noPlayersPerGame,
            totalRounds: potentiallyChangedTotalRounds,
          };
          this.tournamentChanged(tournamentChangedEvent);
        }

        tournament.currentRoundNo = currentRoundNo + 1;
      }

      this.tournamentPlayerModel.bulkWrite(bulkWriteOps, { ordered: false });
      tournament.save();
      if (
        // eslint-disable-next-line unicorn/consistent-destructuring
        tournament.status === TournamentStatus.started
      ) {
        const promotedWithoutPlayingUserId =
          await this.transientDBService.getPromotedUser(tournamentId);
        if (promotedWithoutPlayingUserId) {
          promotedUserIds.push(promotedWithoutPlayingUserId);
          await this.transientDBService.deletePromotedUser(tournamentId);
        }
        this._startNewRound(tournament, promotedUserIds);
      }

      return roundEndResponse;
    } catch (error) {
      this.logger.error('Error Occured during Round End handling');
      this.logger.error(error);
      throw error;
    }
  }

  private async generateLeaderBoardAndCreditWinAmount(
    tournamentId: string,
    players: LudoTournamentPlayerDocument[],
    currentRoundNo: number,
    winningPrizes: WinningPrize[],
    forWinners: boolean,
  ) {
    const noJoinedPlayers =
      await this.ludoTournamentRepository.getNoJoinedPlayers(tournamentId);

    const predicate = forWinners
      ? (player: LudoTournamentPlayerDocument) => player.lostRoundNo === 0
      : (player: LudoTournamentPlayerDocument) =>
          player.lastPlayedRoundNo === currentRoundNo &&
          player.lostRoundNo !== 0;

    // eslint-disable-next-line unicorn/no-array-callback-reference
    const playersToRank = players.filter(predicate);

    if (forWinners) {
      await Promise.all(
        playersToRank.map(({ userId }) =>
          this.transientDBService.deleteUserTournamentId(userId.toString()),
        ),
      );
    }

    const playersInLeaderboard = await this.tournamentLeaderboardModel
      .find({ tournamentId: toObjectId(tournamentId) }, { _id: 0, userId: 1 })
      .lean();

    // Remove users who has already been added in leaderboard
    const indexesToRemove = [];
    for (const [index, playerToRank] of playersToRank.entries()) {
      if (
        playersInLeaderboard.findIndex(
          ({ userId }) => userId === playerToRank.userId,
        ) !== -1
      ) {
        indexesToRemove.push(index);
      }
    }

    if (indexesToRemove.length > 0) {
      // Sort the indexes to remove in descending order
      indexesToRemove.sort((a, b) => b - a);

      for (const index of indexesToRemove) {
        this.logger.warn(
          `Double Leaderboard issue in tournament ${tournamentId}: ${playersToRank[index]}`,
        );
        playersToRank.splice(index, 1);
      }
    }

    const sortedPlayersByScore: {
      userId: ObjectId;
      rank?: number;
      lastRoundScore: number;
      username: string;
    }[] = playersToRank.sort((a, b) => a.lastRoundScore - b.lastRoundScore);

    const noLeaderboardEntries = playersInLeaderboard.length;
    let rankToAssign = noJoinedPlayers - noLeaderboardEntries;
    for (const lostPlayer of sortedPlayersByScore) {
      lostPlayer.rank = rankToAssign--;
    }

    const newPlayersForLeaderboard = sortedPlayersByScore.map(
      ({ userId, rank, lastRoundScore: score, username }) => ({
        userId,
        score,
        rank,
        winAmount: calculateWinAmount(winningPrizes, rank as number),
        roundNo: currentRoundNo,
        username,
      }),
    );

    // handle same scores
    for (let index = 0; index < newPlayersForLeaderboard.length; ) {
      let sameScoreCount = 1;
      for (
        ;
        index + sameScoreCount < newPlayersForLeaderboard.length;
        sameScoreCount++
      ) {
        if (
          newPlayersForLeaderboard[index].score !==
          newPlayersForLeaderboard[index + sameScoreCount].score
        ) {
          break;
        }
      }
      if (sameScoreCount > 1) {
        // average win amount
        let sum = Big(0);
        for (let index_ = 0; index_ < sameScoreCount; index_++) {
          sum = sum.add(newPlayersForLeaderboard[index + index_].winAmount);
        }
        const average = sum.div(sameScoreCount).toFixed(2).toString();
        for (let index_ = 0; index_ < sameScoreCount; index_++) {
          newPlayersForLeaderboard[index + index_].winAmount = average;
        }

        // reassign rank
        for (let index_ = 0; index_ < sameScoreCount - 1; index_++) {
          newPlayersForLeaderboard[index + index_].rank =
            newPlayersForLeaderboard[index + sameScoreCount - 1].rank;
        }
      }
      index += sameScoreCount;
    }

    const newLeaderboardEntries = newPlayersForLeaderboard.map(
      ({ userId, score, rank, winAmount, roundNo, username }) => ({
        tournamentId: toObjectId(tournamentId),
        userId,
        score,
        rank,
        winAmount,
        roundNo,
        username,
      }),
    );
    await this.tournamentLeaderboardModel.insertMany(newLeaderboardEntries);

    const prizeCredits: PrizeCredit[] = newPlayersForLeaderboard
      .filter(({ winAmount }) => Number(winAmount) !== 0)
      .map(({ userId, winAmount }) => ({
        userId: userId.toString(),
        winAmount,
      }));
    this.creditWinAmount(tournamentId, prizeCredits);
  }

  private creditWinAmount(tournamentId: string, prizeCredits: PrizeCredit[]) {
    this.walletProvider.creditLudoTournamentPrize(tournamentId, prizeCredits);
  }

  private async tournamentChanged(
    tournamentChangedEvent: TournamentChangedEvent,
  ) {
    this.ludoGameplayProvider.tournamentChanged(tournamentChangedEvent);
  }

  private async _startNewRound(
    tournament: LudoTournamentDocument,
    promoteduserIds: string[],
  ) {
    const tournamentDTO =
      await this.ludoTournamentRepository.fromTournamentDoc(tournament);
    const {
      id: tournamentId,
      name: tournamentName,
      currentRoundNo,
      noPlayersPerGame,
      maxNoPlayers,
      joinFee,
      winningPrizes,
      totalAmount,
      winnerCount,
      totalRounds,
      startAt: tournamentStartTime,
      status,
    } = tournamentDTO;

    if ([TournamentStatus.ended, TournamentStatus.canceled].includes(status)) {
      return;
    }
    const noJoinedPlayers =
      await this.ludoTournamentRepository.getNoJoinedPlayers(tournamentId);
    const startAt = calculateRoundStartTime(
      tournamentStartTime.toISOString(),
      currentRoundNo,
      noPlayersPerGame,
    );
    const remainingUsers = promoteduserIds.length;
    const userIdsChunks = [];
    while (promoteduserIds.length > 0) {
      const chunk = promoteduserIds.splice(0, 8192);
      userIdsChunks.push(chunk);
    }
    await Promise.all(
      userIdsChunks.map((userIds) =>
        this.ludoGameplayProvider.startRound({
          tournamentId,
          tournamentName,
          roundNo: currentRoundNo,
          userIds,
          maxNoPlayers,
          noPlayersPerGame,
          noJoinedPlayers,
          joinFee,
          winningPrizes,
          totalAmount,
          winnerCount,
          totalRounds,
          startAt,
          remainingUsers,
        }),
      ),
    );

    const { duration, unit } = getRoundDuration(noPlayersPerGame);
    const endAt = dayjs(startAt)
      .add(config.ludoGameplay.tournamentRoundWaitingTime, 'seconds')
      .add(duration, unit as dayjs.ManipulateType)
      .toISOString();
    this.schedulerProvider.scheduleEndRound(
      tournamentId,
      currentRoundNo,
      endAt,
    );
  }

  async ignoreTournament(tournamentId: string, userId: string) {
    const tournament = await this.tournamentModel
      .findById(tournamentId, {
        currentRoundNo: 1,
      })
      .lean();
    if (!tournament) {
      const errorMessage = `Tournament does not exist: ${tournamentId}`;
      this.logger.error(errorMessage);
      throw new NotFoundException(errorMessage);
    }
    const { currentRoundNo } = tournament;
    const player = await this.tournamentPlayerModel.findOne({
      tournamentId,
      userId,
    });
    if (!player) {
      const errorMessage = `User ${userId} Not found in tournament ${tournamentId}`;
      this.logger.error(errorMessage);
      throw new NotFoundException(errorMessage);
    }
    player.lostRoundNo = currentRoundNo === 0 ? 1 : currentRoundNo;
    this.transientDBService.deleteUserTournamentId(userId);
    player.save();
  }

  async createTournament(createTournamentDto: CreateTournamentDto) {
    const tournament: Partial<TournamentDTO> = createTournamentDto;

    const {
      startAt,
      maxNoPlayers,
      minNoPlayers,
      noPlayersPerGame,
      joinFee,
      winningPrizes,
    } = createTournamentDto;

    try {
      if (dayjs().subtract(30, 'seconds').isAfter(startAt)) {
        throw new BadRequestException(
          'Registeration deadline has already passed',
        );
      }

      if (maxNoPlayers < minNoPlayers) {
        throw new BadRequestException(
          'Max number of players cannot be smaller than Min number',
        );
      }

      // const joinAmounts = this.configService.getLudoJoinAmounts();
      // if (!joinAmounts.includes(joinFee)) {
      //   throw new BadRequestException(`Not Allowed join fee: ${joinFee}`);
      // }
      tournament.isActive = true;
      tournament.isDeleted = false;
      tournament.status = TournamentStatus.created;
      const totalRounds = calculateTotalRounds(maxNoPlayers, noPlayersPerGame);
      tournament.totalRounds = totalRounds;
      const registerTill = dayjs(startAt).subtract(30, 'seconds');
      tournament.registerTill = registerTill.toDate();

      if (joinFee !== '0') {
        const totalAmount = Big(joinFee).mul(maxNoPlayers);
        for (const winningPrize of winningPrizes) {
          const { percentage } = winningPrize;
          winningPrize.amount = totalAmount
            .mul(percentage)
            .div(100)
            .round(2)
            .toString();
        }
      }

      // predict end time
      const endTime = calculateRoundStartTime(
        startAt,
        totalRounds + 2,
        noPlayersPerGame,
      );
      tournament.endAt = new Date(endTime);

      const tournamentDocument = new this.tournamentModel(tournament);
      if (!config.isLocal) {
        const { firebase } = config.ludoTournament;
        const { appId, domainUriPrefix, packageName } = firebase;
        const dynamicLinkRequest = {
          tournamentId: String(tournamentDocument._id),
          appId,
          domainUriPrefix,
          packageName,
        };
        tournamentDocument.dynamicLink =
          await this.createFirebaseDynamicLink(dynamicLinkRequest);
      }
      await tournamentDocument.save();
      const tournamentId = tournamentDocument._id.toString();

      this.schedulerProvider.scheduleStartTournament(
        tournamentId,
        registerTill.toISOString(),
      );

      for (const index in config.ludoTournament.notificationsBefore) {
        const { time, unit } = config.ludoTournament.notificationsBefore[index];
        const triggerAt = dayjs(startAt).subtract(
          time,
          unit as dayjs.ManipulateType,
        );
        this.schedulerProvider.scheduleTournamentNotifications(
          tournamentId,
          Number(index),
          triggerAt.toISOString(),
        );
      }

      return tournamentId;
    } catch (error) {
      this.logger.error('Error creating new tournament...', {
        error,
      });
      throw error;
    }
  }

  async updateTournament(
    tournamentId: string,
    updateTournamentDto: UpdateTournamentDto,
  ) {
    await this.tournamentModel.findByIdAndUpdate(tournamentId, {
      $set: updateTournamentDto,
    });
  }

  private async createFirebaseDynamicLink(
    dynamicLinkRequest: FirebaseDynamicLinkRequest,
  ): Promise<string> {
    const { domainUriPrefix, packageName, tournamentId, appId } =
      dynamicLinkRequest;
    const { firebaseApiEndpoint } = config.ludoTournament.firebase;
    const payload = {
      dynamicLinkInfo: {
        domainUriPrefix,
        link: `https://ludoempire.com/?PlayTournament=${tournamentId}`,
        androidInfo: {
          androidPackageName: packageName,
          androidFallbackLink: 'https://ludoempire.com',
        },
      },
      suffix: {
        option: 'SHORT',
      },
    };
    const { shortLink } = await this.httpClientService.post<{
      shortLink: string;
    }>(`${firebaseApiEndpoint}?key=${appId}`, payload);
    return shortLink;
  }

  async startTournament(tournamentId: string) {
    const tournament = await this.tournamentModel.findById(tournamentId);
    if (!tournament) {
      const errorMessage = `Can't start tournament that does not exist: ${tournamentId}`;
      this.logger.error(errorMessage);
      throw new InternalServerErrorException(errorMessage);
    }
    const {
      minNoPlayers,
      joinFee,
      winningPrizes,
      noPlayersPerGame,
      startAt,
      status,
      maxNoPlayers,
      isAutomatic,
    } = tournament;
    if (status === TournamentStatus.canceled) {
      throw new Error(`Can't start Tournament, it's Already Canceled`);
    }

    const [userIds, remainingPlayers] = await Promise.all([
      this.ludoTournamentRepository.getTournamentUserIds(tournamentId),
      this.ludoTournamentRepository.getNoRemainingPlayers(tournamentId),
    ]);

    const noJoinedPlayers = userIds.length;

    if (noJoinedPlayers < minNoPlayers) {
      const errorMessage = `Can't start tournament that does not reach the minimum number of players (${minNoPlayers}), only ${noJoinedPlayers} player${
        noJoinedPlayers === 1 ? '' : 's'
      } registered`;
      this.logger.error(errorMessage);
      tournament.status = TournamentStatus.canceled;
      tournament.isActive = false;
      tournament.isDeleted = true;
      tournament.endAt = dayjs().toDate();
      await tournament.save();

      this.refundTournamentFee(tournamentId);
      const tournamentTerminationEvent: TournamentTerminationData = {
        tournamentId,
        reason: errorMessage,
      };
      return this.tournamentForceTerminated(tournamentTerminationEvent);
    }
    tournament.currentRoundNo = 1;

    const totalRounds = calculateTotalRounds(noJoinedPlayers, noPlayersPerGame);
    tournament.totalRounds = totalRounds;
    await tournament.save();

    const tournamentChangedEvent: TournamentChangedEvent = {
      tournamentId,
      joinedPlayer: noJoinedPlayers,
      totalRounds,
    };
    await this.tournamentChanged(tournamentChangedEvent);

    if (joinFee !== '0') {
      const totalAmount = Big(joinFee).mul(noJoinedPlayers);
      for (const winningPrize of winningPrizes) {
        const { percentage } = winningPrize;
        winningPrize.amount = totalAmount
          .mul(percentage)
          .div(100)
          .round(2)
          .toString();
      }
    }

    if (remainingPlayers === 1) {
      await this.cancelTournament(tournamentId, 'Not enough players to Start');
      tournament.isActive = false;
      tournament.status = TournamentStatus.ended;
      tournament.endAt = dayjs().toDate();
    }

    tournament.markModified('winningPrizes');
    await tournament.save();
    const { currentRoundNo } = tournament;
    if (currentRoundNo === 1) {
      await this._startNewRound(tournament, userIds);
    }

    setTimeout(
      async () => {
        const tournament = (await this.tournamentModel.findById(
          tournamentId,
        )) as LudoTournamentDocument;
        tournament.status = TournamentStatus.started;
        await tournament.save();

        if (noJoinedPlayers < maxNoPlayers && isAutomatic) {
          await this.saveRepeatedTournament(tournamentId, isAutomatic);
        }
      },
      dayjs(startAt).diff(dayjs(), 'milliseconds'),
    );
  }

  private refundTournamentFee(tournamentId: string) {
    this.walletProvider.refundLudoTournamentFee(tournamentId);
  }

  private async tournamentForceTerminated({
    tournamentId,
    reason,
  }: TournamentTerminationData) {
    this.ludoGameplayProvider.tournamentCanceled({ tournamentId, reason });
    // this.notificationProvider.tournamentCanceled({tournamentId, reason});
  }

  async cancelTournament(tournamentId: string, reason: string) {
    const tournament = await this.tournamentModel.findByIdAndUpdate(
      tournamentId,
      {
        status: TournamentStatus.canceled,
      },
    );

    if (!tournament) {
      const errorMessage = `Tournament that does not exist: ${tournamentId}`;
      this.logger.error(errorMessage);
      throw new InternalServerErrorException(errorMessage);
    }

    const { endAt } = tournament;

    if (dayjs(endAt).isBefore(dayjs())) {
      throw new BadRequestException(
        `Tournament ${tournamentId} can not be cancelled, it's Already ended.`,
      );
    }

    tournament.status = TournamentStatus.canceled;
    tournament.isActive = false;
    tournament.isDeleted = true;
    tournament.endAt = dayjs().toDate();
    await tournament.save();

    this.refundTournamentFee(tournamentId);

    const tournamentTerminationEvent: TournamentTerminationData = {
      tournamentId,
      reason,
    };
    return this.tournamentForceTerminated(tournamentTerminationEvent);
  }

  async saveRepeatedTournament(tournamentId: string, isAutomatic?: boolean) {
    const tournament = await this.tournamentModel.findById(tournamentId).lean();

    if (!tournament) {
      throw new NotFoundException(`Tournament ${tournamentId} not found!`);
    }

    const { createdAt: oldTournamentCreatedAt, alias } = tournament;

    const repeatedTournament = JSON.parse(JSON.stringify(tournament));
    delete repeatedTournament._id;
    delete repeatedTournament.createdAt;
    delete repeatedTournament.updatedAt;
    delete repeatedTournament.filledAt;
    delete repeatedTournament.registerTill;

    const { repeatDuration, autoRepeatDuration } = config.ludoTournament;
    const { startTime } = isAutomatic ? autoRepeatDuration : repeatDuration;
    const fillingTimeInMinutes = dayjs().diff(oldTournamentCreatedAt, 'minute');

    const repeatTournamentTime =
      this.ludoRemoteConfig.getTournamentRepeatTime();
    const registerTill = dayjs()
      .add(fillingTimeInMinutes + repeatTournamentTime, 'minute')
      .toDate();
    const startAt = dayjs(registerTill).add(startTime, 'minute').toDate();
    repeatedTournament.startAt = startAt;
    repeatedTournament.activatedAt = new Date();

    const nameSuffix = dayjs(startAt).tz('Asia/Kolkata').format('hh:mm A');
    repeatedTournament.name = `${alias} ${nameSuffix}`;

    await this.createTournament(repeatedTournament);
  }

  async joinTournament(
    tournamentId: string,
    userId: string,
  ): Promise<TournamentDTO> {
    try {
      await this.redisService.aquireLock(tournamentId);
      const tournament = await this.tournamentModel.findById(tournamentId);
      let noJoinedPlayers =
        await this.ludoTournamentRepository.getNoJoinedPlayers(tournamentId);

      if (!tournament) {
        throw new NotFoundException(`Tournament ${tournamentId} not found!`);
      }

      const {
        registerTill,
        maxNoPlayers,
        joinFee,
        isRepeatable,
        isActive,
        isDeleted,
        noPlayersPerGame,
      } = tournament;

      if (!isActive) {
        throw new BadRequestException(
          `Tournament ${tournamentId} is not active`,
        );
      }
      if (isDeleted) {
        throw new BadRequestException(`Tournament ${tournamentId} is deleted`);
      }

      if (dayjs(registerTill).isBefore(dayjs())) {
        throw new BadRequestException(
          `Tournament ${tournamentId} registeration time ended`,
        );
      }

      // Check Tournament full
      if (noJoinedPlayers >= maxNoPlayers) {
        throw new BadRequestException(`Tournament ${tournamentId} is full`);
      }

      // Check Already join Tournament.
      const joinedStatus = await this.tournamentPlayerModel.findOne({
        tournamentId: toObjectId(tournamentId),
        userId: toObjectId(userId),
      });
      if (!!joinedStatus) {
        throw new BadRequestException(
          `User ${userId} already joined Tournament ${tournamentId}`,
        );
      }

      // Debit tournament EntryFee.
      await this.debitTournamentJoinFee(tournamentId, userId, joinFee);
      const username = await this.userRepository.getUsername(userId);

      // Save Tournament Player
      const newPlayer = new this.tournamentPlayerModel({
        tournamentId: toObjectId(tournamentId),
        lastPlayedRoundNo: 0,
        lostRoundNo: 0,
        lastRoundScore: 0,
        userId: toObjectId(userId),
        rounds: [],
        username,
      });

      await newPlayer.save();

      noJoinedPlayers++;

      if (noJoinedPlayers === maxNoPlayers) {
        tournament.filledAt = dayjs().toDate();
      }

      //totalRounds
      const totalRounds = calculateTotalRounds(maxNoPlayers, noPlayersPerGame);
      tournament.totalRounds = totalRounds;
      await tournament.save();

      const tournamentChangedEvent: TournamentChangedEvent = {
        tournamentId,
        joinedPlayer: noJoinedPlayers,
        totalRounds,
      };
      await this.tournamentChanged(tournamentChangedEvent);

      if (noJoinedPlayers >= maxNoPlayers && isRepeatable) {
        await this.saveRepeatedTournament(tournamentId);
      }
      return this.ludoTournamentRepository.fromTournamentDoc(tournament);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      } else {
        this.logger.error(
          `Can't join tournament at the moment, please try again ${tournamentId} & ${userId}`,
        );
        this.logger.error(error);
        throw new InternalServerErrorException(
          "Can't join tournament at the moment, please try again",
        );
      }
    } finally {
      await this.redisService.releaseLock(tournamentId);
    }
  }

  async getTournamentById(
    tournamentId: string,
    userId?: string,
  ): Promise<TournamentDTO | undefined> {
    try {
      const tournament = await this.tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new NotFoundException(
          `Tournament with id ${tournamentId} not found`,
        );
      }
      const tournamentDTO =
        await this.ludoTournamentRepository.fromTournamentDoc(tournament);

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

      let canPlay = false;

      if (userId) {
        const userInfo = await this.tournamentPlayerModel.findOne(
          { tournamentId, userId },
          { _id: 0, lostRoundNo: 1 },
        );
        canPlay = userInfo?.lostRoundNo === 0;
      }

      return { ...tournamentDTO, canPlay };
    } catch {}
  }

  async getTournaments({
    skip = 0,
    limit = 0,
    sortBy,
    sortDir,
    noPlayersPerGame,
    minJoinFee,
    maxJoinFee,
    winnerCount,
    userId,
    isActive,
    joinable,
    featured,
  }: TournamentFilterWithPagination) {
    const matchFilterOption: any = {};
    if (noPlayersPerGame) {
      matchFilterOption.noPlayersPerGame = noPlayersPerGame;
    }
    if (minJoinFee || maxJoinFee) {
      matchFilterOption['$expr'] = {
        $and: [
          minJoinFee && {
            $gte: [{ $toDouble: '$joinFee' }, Number(minJoinFee)],
          },
          maxJoinFee && {
            $lte: [{ $toDouble: '$joinFee' }, Number(maxJoinFee)],
          },
        ].filter(Boolean),
      };
    }

    if (isActive !== undefined) {
      matchFilterOption.isActive = isActive;
    }

    if (winnerCount !== undefined) {
      if (winnerCount === 'single') {
        matchFilterOption.winningPrizes = {
          $size: 1,
        };
        matchFilterOption['winningPrizes.0.maxRank'] = 1;
      } else {
        matchFilterOption['$or'] = [
          { 'winningPrizes.1': { $exists: true } },
          { 'winningPrizes.0.maxRank': { $gt: 1 } },
        ];
      }
    }

    if (joinable !== undefined) {
      if (joinable && userId) {
        matchFilterOption.isActive = true;
        matchFilterOption.registerTill = {
          $gt: dayjs().toDate(),
        };
        matchFilterOption.filledAt = {
          $exists: false,
        };
        if (featured !== undefined) {
          matchFilterOption.featured = featured;
        }
      } else {
        matchFilterOption.registerTill = joinable
          ? {
              $gt: dayjs().toDate(),
            }
          : {
              $lt: dayjs().toDate(),
            };
      }
    }

    matchFilterOption['status'] = {
      $ne: TournamentStatus.canceled,
    };

    if (userId) {
      // Currently FE asks only 4 tournaments at the same tiem, max limit is set to 100 in case of other filters may kick in
      const tournamentIdLimit = 100;
      const tournamentPlayers = await this.tournamentPlayerModel
        .find({ userId: toObjectId(userId) }, { _id: 0, tournamentId: 1 })
        .sort({ tournamentId: -1 })
        .limit(tournamentIdLimit)
        .lean();
      const tournamentIds = tournamentPlayers.map(
        ({ tournamentId }) => tournamentId,
      );

      matchFilterOption._id = joinable
        ? {
            $nin: tournamentIds,
          }
        : {
            $in: tournamentIds,
          };
    }

    const [tournamentData] = await this.tournamentModel
      .aggregate([
        {
          $match: matchFilterOption,
        },
        {
          $facet: {
            tournamentDocuments: [
              { $sort: { [sortBy]: sortDir } },
              { $skip: skip },
              { $limit: limit },
              { $project: { __v: 0 } },
            ],
            totalDocumentCount: [
              // eslint-disable-next-line unicorn/no-null
              { $group: { _id: null, totalCount: { $sum: 1 } } },
            ],
          },
        },
        {
          $project: {
            tournamentDocuments: 1,
            totalDocumentCount: {
              $arrayElemAt: ['$totalDocumentCount.totalCount', 0],
            },
          },
        },
        {
          $addFields: {
            tournamentDocuments: '$tournamentDocuments',
            totalDocumentCount: '$totalDocumentCount',
          },
        },
        {
          $project: {
            _id: 0,
          },
        },
      ])
      .exec();

    const tournamentDocuments: LudoTournamentDocument[] =
      tournamentData.tournamentDocuments;
    const totalCount: number = tournamentData.totalDocumentCount;
    const tournamentDtos = await Promise.all(
      tournamentDocuments.map((tournamentDocument) =>
        this.ludoTournamentRepository.fromTournamentDoc(tournamentDocument),
      ),
    );

    return {
      items: tournamentDtos,
      meta: {
        totalCount,
        skip,
        count: tournamentDocuments.length,
      },
    };
  }

  async debitTournamentJoinFee(
    tournamentId: string,
    userId: string,
    joinFee: string,
  ) {
    const enoughBalance = await this.walletProvider.checkLudoWalletBalance(
      userId,
      joinFee,
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!enoughBalance) {
      throw new BadRequestException(
        `User ${userId} has insufficient wallet balance`,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.walletProvider.debitLudoTournamentJoinFee(
      [userId],
      joinFee,
      tournamentId,
    );
  }

  async getLeaderboard({
    skip,
    limit,
    tournamentId,
    roundNo,
    userId,
  }: GetLeaderboardRequest) {
    const [items, totalCount, myPlayer] = await Promise.all([
      this.tournamentLeaderboardModel
        .find(
          {
            tournamentId: toObjectId(tournamentId),
            roundNo,
          },
          {
            _id: 0,
            userId: 1,
            rank: 1,
            score: 1,
            winAmount: 1,
            username: 1,
          },
        )
        .sort({ rank: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.tournamentLeaderboardModel.countDocuments({
        tournamentId: toObjectId(tournamentId),
        roundNo,
      }),
      this.tournamentLeaderboardModel
        .findOne(
          {
            tournamentId: toObjectId(tournamentId),
            userId: toObjectId(userId),
          },
          {
            _id: 0,
            userId: 1,
            rank: 1,
            score: 1,
            winAmount: 1,
            username: 1,
          },
        )
        .lean(),
    ]);

    return {
      items,
      myPlayer,
      meta: {
        totalCount,
        skip,
        count: Math.min(totalCount, limit),
      },
    };
  }

  async getRoundInfo(
    tournamentId: string,
    roundNo: number,
    userId: string,
  ): Promise<RoundInfo> {
    const tournament = await this.tournamentModel
      .findById(tournamentId, {
        _id: 0,
        noPlayersPerGame: 1,
        startAt: 1,
        currentRoundNo: 1,
      })
      .lean();
    if (!tournament) {
      const errorMessage = `Tournament Not found: ${tournamentId}`;
      this.logger.error(errorMessage);
      throw new InternalServerErrorException(errorMessage);
    }
    const { startAt, noPlayersPerGame, currentRoundNo } = tournament;

    const players =
      roundNo <= currentRoundNo
        ? await this.ludoGameplayProvider.getRoundPlayers({
            tournamentId,
            roundNo,
            userId,
          })
        : [];

    const startTime = calculateRoundStartTime(
      startAt,
      roundNo,
      noPlayersPerGame,
    );

    return {
      startAt: startTime,
      players,
    };
  }

  async getFinishedRounds(
    tournamentId: string,
    userId: string,
  ): Promise<RoundResult> {
    const [roundsData, leaderboardData] = await Promise.all([
      this.tournamentPlayerModel
        .aggregate([
          {
            $match: {
              tournamentId: toObjectId(tournamentId),
              userId: toObjectId(userId),
            },
          },
          { $unwind: '$rounds' },
          {
            $project: {
              roundNo: '$rounds.roundNo',
              score: '$rounds.score',
              roomCode: '$rounds.tableId',
            },
          },
        ])
        .exec(),

      this.tournamentLeaderboardModel
        .findOne(
          {
            tournamentId: toObjectId(tournamentId),
            userId: toObjectId(userId),
          },
          {
            _id: 0,
            winAmount: 1,
            rank: 1,
          },
        )
        .lean(),
    ]);

    const roundResult: RoundResult = {};

    if (leaderboardData) {
      roundResult.winAmount = leaderboardData.winAmount;
      roundResult.rank = leaderboardData.rank;
    }

    if (roundsData) {
      roundResult.rounds = roundsData;
    }

    return roundResult;
  }

  async checkIfFinished(
    tournamentId: string,
    roundNo: number,
    userId: string,
  ): Promise<CheckIfFinishedResult> {
    const tournament = await this.tournamentModel.findById(tournamentId, {
      _id: 0,
      name: 1,
      status: 1,
      noPlayersPerGame: 1,
      currentRoundNo: 1,
      totalRounds: 1,
    });

    if (!tournament) {
      const errorMessage = `Tournament that does not exist: ${tournamentId}`;
      this.logger.error(errorMessage);
      throw new InternalServerErrorException(errorMessage);
    }

    const { name, noPlayersPerGame, totalRounds, status } = tournament;
    if (roundNo < totalRounds) {
      return {
        finished: false,
      };
    }

    // last round result may be still being processed
    let updatedStatus = status;

    while (updatedStatus !== TournamentStatus.ended) {
      const potentiallyUpdatedTournament = (await this.tournamentModel.findById(
        tournamentId,
        {
          _id: 0,
          status: 1,
          currentRoundNo: 1,
        },
      )) as LudoTournamentDocument;
      const { status, currentRoundNo: potentiallyUpdatedRoundNo } =
        potentiallyUpdatedTournament;

      if (
        status === TournamentStatus.ended ||
        potentiallyUpdatedRoundNo !== roundNo
      ) {
        updatedStatus = status;
        break;
      }
      await delay(100);
    }

    if (updatedStatus === TournamentStatus.ended) {
      const playerInLeaderboard = await this.tournamentLeaderboardModel
        .findOne(
          {
            tournamentId: toObjectId(tournamentId),
            userId: toObjectId(userId),
          },
          {
            _id: 0,
            rank: 1,
            winAmount: 1,
          },
        )
        .lean();
      if (!playerInLeaderboard) {
        const errorMessage = `User ${userId} can not be found in Tournament ${tournamentId} leaderboard`;
        this.logger.error(errorMessage);
        throw new InternalServerErrorException(errorMessage);
      }
      const { rank, winAmount } = playerInLeaderboard;
      return {
        finished: true,
        tournamentId,
        tournamentName: name,
        rank,
        noPlayersPerGame,
        prize: winAmount,
      };
    } else {
      return {
        finished: false,
      };
    }
  }

  async getUserStatus(
    tournamentId: string,
    userId: string,
  ): Promise<UserTournamentStatus> {
    const player = await this.tournamentPlayerModel
      .findOne(
        {
          tournamentId: toObjectId(tournamentId),
          userId: toObjectId(userId),
        },
        {
          _id: 0,
          lostRoundNo: 1,
        },
      )
      .lean();
    if (!player) {
      // Not Registered
      return {
        isRegistered: false,
        canPlay: false,
      };
    }

    return {
      isRegistered: true,
      canPlay: player.lostRoundNo === 0,
    };
  }

  async getMyRank(tournamentId: string, userId: string): Promise<UserRank> {
    const player = await this.tournamentLeaderboardModel
      .findOne(
        {
          tournamentId: toObjectId(tournamentId),
          userId: toObjectId(userId),
        },
        {
          _id: 0,
          rank: 1,
          winAmount: 1,
        },
      )
      .lean();
    if (!player) {
      // rank not generated
      return {
        rank: 0,
        winAmount: '0',
      };
    }

    return {
      rank: player.rank,
      winAmount: player.winAmount,
    };
  }
}
