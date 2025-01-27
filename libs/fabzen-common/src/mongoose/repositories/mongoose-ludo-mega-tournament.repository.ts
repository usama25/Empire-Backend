import * as dayjs from 'dayjs';
import * as Big from 'big.js';
import { Model, Types } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { LudoMegaTournamentEntity } from '@lib/fabzen-common/entities/ludo-mega-tournament.entity';
import {
  LudoMegaTournamentFilterWithPagination,
  Paginated,
  LudoMegaTournamentWinningPrize,
  LudoMegaTournamentStatus,
  LudoMegaTournamentPrize,
  Games,
  Stat,
  GameOutcome,
} from '@lib/fabzen-common/types';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';

import {
  GameHistory,
  GameHistoryDocument,
  LudoMegaTournament,
  LudoMegaTournamentDocument,
  LudoMegaTournamentPlayer,
  LudoMegaTournamentPlayerDocument,
  User,
  UserDocument,
} from '../models';
import { LudoMegaTournamentRepository } from 'apps/ludo-mega-tournament/src/domain/interfaces';
import {
  CreateLudoMegaTournamentDto,
  LeaderboardDto,
  LeaderboardEntryDto,
} from 'apps/rest-api/src/subroutes/ludo/mega-tournament/mega-tournament.dto';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { GetLeaderboardRequest } from 'apps/ludo-mega-tournament/src/infrastructure/controllers/types';
import { FinishedGameInfo } from 'apps/ludo-mega-tournament/src/domain/use-cases';
import { LudoMegaTournamentHistoryDto } from 'apps/rest-api/src/subroutes/history/history.dto';
import { getRandomInteger } from '@lib/fabzen-common/utils/random.utils';
import { config } from '@lib/fabzen-common/configuration';

export class MongooseLudoMegaTournamentRepository
  implements LudoMegaTournamentRepository
{
  constructor(
    @InjectModel(LudoMegaTournament.name)
    public ludoMegaTournamentModel: Model<LudoMegaTournamentDocument>,
    @InjectModel(LudoMegaTournamentPlayer.name)
    public ludoMegaTournamentPlayerModel: Model<LudoMegaTournamentPlayerDocument>,
    @InjectModel(User.name)
    public userModel: Model<UserDocument>,
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    private readonly userRepository: UserRepository,
  ) {}

  async createLudoMegaTournament(
    createLudoMegaTournamentDto: CreateLudoMegaTournamentDto,
  ): Promise<LudoMegaTournamentEntity> {
    const newTournament = await this.ludoMegaTournamentModel.create(
      createLudoMegaTournamentDto,
    );
    return await this.#toEntity(newTournament);
  }

  async getTournamentById(
    tournamentId: string,
    userId?: string,
  ): Promise<LudoMegaTournamentEntity> {
    const tournamentDocument =
      await this.ludoMegaTournamentModel.findById(tournamentId);
    if (!tournamentDocument) {
      throw new NotFoundException(`Tournament ${tournamentId} not found`);
    }
    return await this.#toEntity(tournamentDocument, userId);
  }

  async updateTournament(
    tournamentId: string,
    updates?: Partial<LudoMegaTournamentEntity> | undefined,
  ) {
    await this.ludoMegaTournamentModel.findByIdAndUpdate(tournamentId, {
      $set: updates,
    });
  }

  async getTournaments(
    filter: LudoMegaTournamentFilterWithPagination,
  ): Promise<Paginated<LudoMegaTournamentEntity>> {
    const filterQuery = await this.#constructFilterQuery(filter);
    const { skip, limit, userId, sortBy, sortDir } = filter;
    const [tournamentDocuments, totalCount] = await Promise.all([
      this.ludoMegaTournamentModel
        // eslint-disable-next-line unicorn/no-array-callback-reference
        .find(filterQuery)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),

      this.ludoMegaTournamentModel.countDocuments(filterQuery),
    ]);
    const tournamentEntities = await Promise.all(
      tournamentDocuments.map((tournamentDocument) =>
        this.#toEntity(tournamentDocument, userId),
      ),
    );

    // Remove `pawnPositions` as it is not used at all
    for (const tournamentEntity of tournamentEntities) {
      tournamentEntity.pawnPositions = [];
    }

    return {
      items: tournamentEntities,
      meta: {
        totalCount,
        skip,
        limit: tournamentEntities.length,
      },
    };
  }

  async getUserEntryCount(
    tournamentId: string,
    userId: string,
  ): Promise<number> {
    return await this.ludoMegaTournamentPlayerModel.countDocuments({
      tournamentId: toObjectId(tournamentId),
      userId: toObjectId(userId),
    });
  }

  async getUserHighestScore(
    tournamentId: string,
    userId: string,
  ): Promise<number> {
    const highestScoreDocument = await this.ludoMegaTournamentPlayerModel
      .find({
        tournamentId: toObjectId(tournamentId),
        userId: toObjectId(userId),
      })
      .sort({ score: -1 })
      .limit(1)
      .select({ score: 1, _id: 0 })
      .exec();

    const highestScore = highestScoreDocument[0]?.score ?? 0;
    return highestScore;
  }

  async #constructFilterQuery({
    isActive,
    minJoinFee,
    maxJoinFee,
    winnerCount,
    userId,
  }: LudoMegaTournamentFilterWithPagination) {
    const filterQuery: any = {};
    if (isActive) {
      filterQuery['status'] = LudoMegaTournamentStatus.live;
    } else {
      filterQuery['status'] = LudoMegaTournamentStatus.completed;
      // Show only the ones user has played
      // Currently FE asks only 4 tournaments at the same tiem, max limit is set to 100 in case of other filters may kick in

      const tournamentIdLimit = 100;
      const tournamentPlayers = await this.ludoMegaTournamentPlayerModel
        .find({ userId: toObjectId(userId) }, { _id: 0, tournamentId: 1 })
        .sort({ _id: -1 })
        .limit(tournamentIdLimit)
        .lean();
      const tournamentIds = tournamentPlayers.map(
        ({ tournamentId }) => tournamentId,
      );

      filterQuery['_id'] = { $in: tournamentIds };
    }
    if (minJoinFee || maxJoinFee) {
      filterQuery['$expr'] = {
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
    if (winnerCount !== undefined) {
      if (winnerCount === 'single') {
        filterQuery.winningPrizes = {
          $size: 1,
        };
        filterQuery['winningPrizes.0.maxRank'] = 1;
      } else {
        filterQuery['$or'] = [
          { 'winningPrizes.1': { $exists: true } },
          { 'winningPrizes.0.maxRank': { $gt: 1 } },
        ];
      }
    }
    return filterQuery;
  }

  async #toEntity(
    tournamentDocument: LudoMegaTournamentDocument,
    userId?: string,
  ): Promise<LudoMegaTournamentEntity> {
    const {
      _id,
      name,
      alias,
      joinFee,
      status,
      createdAt,
      endAt,
      winningPrizes,
      maxTotalEntries,
      maxEntriesPerUser,
      extensionTime,
      maxExtensionLimit,
      extendedCount,
      enteredUserCount,
      highestScore,
      isRepeatable,
      totalWinAmount,
      useSamePawnPositions,
      pawnPositions,
      totalMoves,
    } = tournamentDocument;

    const tournamentId = _id.toString();
    const totalWinners = this.#calculateTotalWinnerCount(winningPrizes);
    const totalPrizePool = this.#calculateTotalPrizePool(
      joinFee,
      status === LudoMegaTournamentStatus.completed
        ? enteredUserCount
        : maxTotalEntries,
    );
    const deepLink = `emp://ludoMegaTournament/tournamentId=${tournamentId}`;
    let myEntryCount: number = 0,
      myHighestScore: number = 0;
    if (userId) {
      const [entryCount, highestScore] = await Promise.all([
        this.getUserEntryCount(_id.toString(), userId),
        this.getUserHighestScore(_id.toString(), userId),
      ]);
      myEntryCount = entryCount;
      myHighestScore = highestScore;
    }

    return new LudoMegaTournamentEntity(
      tournamentId,
      name,
      alias,
      deepLink,
      joinFee,
      status,
      dayjs(createdAt),
      dayjs(endAt),
      winningPrizes,
      maxTotalEntries,
      maxEntriesPerUser,
      extensionTime,
      maxExtensionLimit,
      extendedCount,
      enteredUserCount,
      totalPrizePool,
      totalWinners,
      isRepeatable,
      myEntryCount,
      myHighestScore,
      highestScore,
      totalWinAmount,
      useSamePawnPositions,
      pawnPositions,
      totalMoves,
    );
  }

  #calculateTotalWinnerCount(
    winningPrizes: LudoMegaTournamentWinningPrize[],
  ): number {
    return Math.max(...winningPrizes.map(({ maxRank }) => maxRank));
  }

  #calculateTotalPrizePool(joinFee: string, maxEntries: number): string {
    return Big(joinFee).mul(maxEntries).toFixed(2);
  }

  #updateWinningPrizeAmounts(
    winningPrizes: LudoMegaTournamentWinningPrize[],
    totalJoinFee: string | number | Big,
  ): LudoMegaTournamentWinningPrize[] {
    const totalJoinFeeBig = Big(totalJoinFee);

    return winningPrizes.map(({ percentage, minRank, maxRank }) => {
      const amount = totalJoinFeeBig.mul(percentage).div(100).toFixed(2);

      return {
        minRank,
        maxRank,
        percentage,
        amount,
      };
    });
  }

  async storeGameResult(
    tournamentId: string,
    userId: string,
    tableId: string,
    score: number,
  ) {
    await Promise.all([
      this.#storeEntryResult(tournamentId, userId, tableId, score),
      this.#updateTournamentHighestScore(tournamentId, score),
    ]);
  }

  async #storeEntryResult(
    tournamentId: string,
    userId: string,
    tableId: string,
    score: number,
  ) {
    const [user, tournament] = await Promise.all([
      this.userRepository.getUser(userId),
      this.ludoMegaTournamentModel.findById(tournamentId, {
        _id: 0,
        name: 1,
        joinFee: 1,
        endAt: 1,
      }),
    ]);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (!tournament) {
      throw new NotFoundException(`Tournament ${tournamentId} not found`);
    }
    const { name, username, avatar, stats, address } = user;
    const { name: tournamentName, joinFee, endAt } = tournament;

    let totalPlayed = 0;
    for (const key in stats) {
      const game = key as Games;
      const gameStats = stats[game];
      const wins = gameStats?.winMatches ?? 0;
      const losses = gameStats?.lossMatches ?? 0;

      totalPlayed += wins + losses;
    }

    const entryCount = await this.ludoMegaTournamentPlayerModel.countDocuments({
      tournamentId: toObjectId(tournamentId),
      userId: toObjectId(userId),
    });

    await this.ludoMegaTournamentPlayerModel.create({
      tournamentId: toObjectId(tournamentId),
      tournamentName,
      joinFee,
      userId: toObjectId(userId),
      username: name || username,
      avatar: avatar ?? getRandomInteger(0, config.user.maxAvatarIndex),
      tableId,
      score,
      totalPlayed,
      entryNo: entryCount + 1,
      state: address?.state,
      endAt,
    });
  }

  async #updateTournamentHighestScore(tournamentId: string, score: number) {
    const tournament = await this.ludoMegaTournamentModel.findById(
      tournamentId,
      {
        _id: 0,
        highestScore: 1,
      },
    );
    const currentHighestScore = tournament?.highestScore ?? 0;
    if (currentHighestScore < score) {
      await this.ludoMegaTournamentModel.findByIdAndUpdate(tournamentId, {
        $set: { highestScore: score },
      });
    }
  }

  async incrementEnteredUserCount(tournamentId: string): Promise<void> {
    await this.ludoMegaTournamentModel.findByIdAndUpdate(tournamentId, {
      $inc: { enteredUserCount: 1 },
    });
  }

  async updateLeaderboard(tournamentId: string) {
    const users: {
      userId: Types.ObjectId;
      score: number;
      entryNo: number;
    }[] = await this.ludoMegaTournamentPlayerModel.aggregate([
      {
        $match: {
          tournamentId: toObjectId(tournamentId),
        },
      },
      {
        $sort: {
          score: -1,
        },
      },
      {
        $project: {
          _id: 0,
          userId: 1,
          score: 1,
          entryNo: 1,
        },
      },
    ]);

    const tournamentDocument = await this.ludoMegaTournamentModel.findById(
      tournamentId,
      { _id: 0, joinFee: 1, winningPrizes: 1, enteredUserCount: 1 },
    );
    if (!tournamentDocument) {
      throw new NotFoundException(`Tournament ${tournamentId} not found`);
    }
    const { joinFee, winningPrizes, enteredUserCount } = tournamentDocument;

    const leaderboardToUpdate: {
      userId: Types.ObjectId;
      entryNo: number;
      rank: number;
      winAmount: string;
      scoreInString: string;
    }[] = [];

    let rank = 0;

    for (const { userId, entryNo, score } of users) {
      rank += 1;

      leaderboardToUpdate.push({
        userId,
        entryNo,
        rank,
        winAmount: this.#calculateWinAmount(
          joinFee,
          enteredUserCount,
          winningPrizes,
          rank,
        ),
        scoreInString: String(score),
      });
    }

    // Handle same ranks, winAmount should be equally distributed
    const sameScoreUsers: Record<string, typeof leaderboardToUpdate> = {};
    for (const user of leaderboardToUpdate) {
      if (!sameScoreUsers[user.scoreInString]) {
        sameScoreUsers[user.scoreInString] = [];
      }
      sameScoreUsers[user.scoreInString].push(user);
    }

    // Divide the win amount equally among users with the same rank
    for (const users of Object.values(sameScoreUsers)) {
      if (users.length > 1) {
        const rank = users[0].rank;

        // eslint-disable-next-line unicorn/no-array-reduce
        const totalWinAmount = users.reduce(
          (accumulator, user) =>
            Big(accumulator).plus(user.winAmount).toNumber(),
          0,
        );
        const winAmount = Big(totalWinAmount).div(users.length).toFixed(2);
        for (const user of users) {
          user.rank = rank;
          user.winAmount = winAmount;
        }
      }
    }

    const leaderboardUpdateOps: any[] = [];
    const gameHistoryInsertOps: any[] = [];
    const userStatsUpdates: Record<string, Stat> = {};
    for (const { userId, entryNo, rank, winAmount } of leaderboardToUpdate) {
      leaderboardUpdateOps.push({
        updateOne: {
          filter: {
            tournamentId: toObjectId(tournamentId),
            userId,
            entryNo,
          },
          update: { $set: { rank, winAmount } },
        },
      });
      gameHistoryInsertOps.push({
        userId,
        tournamentId: toObjectId(tournamentId),
        joinFee,
        winLoseAmount: Number(winAmount),
        outcome: Number(winAmount) === 0 ? GameOutcome.lost : GameOutcome.won,
        game: Games.ludoMegaTournament,
      });
      const userIdString = userId.toString();
      if (!userStatsUpdates[userIdString]) {
        userStatsUpdates[userIdString] = {
          earnedMoney: 0,
          winMatches: 0,
          lossMatches: 0,
        };
      }
      userStatsUpdates[userIdString].earnedMoney += Number(winAmount);
      if (Number(winAmount) === 0) {
        userStatsUpdates[userIdString].lossMatches += 1;
      } else {
        userStatsUpdates[userIdString].winMatches += 1;
      }
    }

    const userStatsUpdateOps = Object.entries(userStatsUpdates).map(
      ([userId, stats]) => ({
        updateOne: {
          filter: { _id: toObjectId(userId) },
          update: {
            $inc: {
              [`stats.${Games.ludoMegaTournament}.earnedMoney`]:
                stats.earnedMoney,
              [`stats.${Games.ludoMegaTournament}.winMatches`]:
                stats.winMatches,
              [`stats.${Games.ludoMegaTournament}.lossMatches`]:
                stats.lossMatches,
            },
          },
        },
      }),
    );

    await Promise.all([
      this.ludoMegaTournamentPlayerModel.bulkWrite(leaderboardUpdateOps),
      this.userModel.bulkWrite(userStatsUpdateOps),
      this.gameHistoryModel.insertMany(gameHistoryInsertOps),
    ]);
  }

  #calculateWinAmount(
    joinFee: string,
    totalEntryCount: number,
    winningPrizes: LudoMegaTournamentWinningPrize[],
    rank: number,
  ): string {
    const prize = winningPrizes.find(
      ({ minRank, maxRank }) => rank <= maxRank && rank >= minRank,
    );
    if (!prize) {
      return '0.00';
    }
    return Big(joinFee)
      .mul(totalEntryCount)
      .mul(prize.percentage)
      .div(100)
      .toFixed(2);
  }

  async getLeaderboard({
    tournamentId,
    userId,
    skip,
    limit,
  }: GetLeaderboardRequest): Promise<LeaderboardDto> {
    const [items, totalCount, myEntries, tournament] = await Promise.all([
      this.#getMainLeaderboardEntries(tournamentId, skip, limit),
      this.ludoMegaTournamentPlayerModel.countDocuments({
        tournamentId: toObjectId(tournamentId),
      }),
      this.#getMyLeaderboardEntries(tournamentId, userId),
      this.ludoMegaTournamentModel.findById(tournamentId, {
        _id: 0,
        status: 1,
      }),
    ]);

    if (!tournament) {
      throw new NotFoundException(`Tournament ${tournamentId} not found`);
    }

    const { status } = tournament;

    let totalWinnings = Big(0);

    for (const myEntry of myEntries) {
      totalWinnings = totalWinnings.add(myEntry.winAmount);
    }

    return {
      items: items as LeaderboardEntryDto[],
      myPlayer: myEntries as LeaderboardEntryDto[],
      status,
      totalWinnings: totalWinnings.toFixed(2),
      meta: {
        totalCount,
        skip,
        limit: Math.min(totalCount, limit),
      },
    };
  }

  async #getMainLeaderboardEntries(
    tournamentId: string,
    skip: number,
    limit: number,
  ) {
    return await this.ludoMegaTournamentPlayerModel
      .aggregate([
        {
          $match: {
            tournamentId: toObjectId(tournamentId),
          },
        },
        {
          $sort: {
            score: -1,
          },
        },
        {
          $project: {
            _id: 0,
            userId: 1,
            username: 1,
            avatar: 1,
            score: 1,
            entryNo: 1,
            winAmount: 1,
            totalPlayed: 1,
            state: 1,
          },
        },
        {
          $setWindowFields: {
            partitionBy: undefined,
            sortBy: { score: -1 },
            output: {
              rank: {
                $rank: {},
              },
            },
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ])
      .exec();
  }

  async #getMyLeaderboardEntries(tournamentId: string, userId: string) {
    return await this.ludoMegaTournamentPlayerModel
      .aggregate([
        {
          $match: {
            tournamentId: toObjectId(tournamentId),
          },
        },
        {
          $sort: {
            score: -1,
          },
        },
        {
          $project: {
            _id: 0,
            userId: 1,
            username: 1,
            avatar: 1,
            score: 1,
            entryNo: 1,
            winAmount: 1,
            totalPlayed: 1,
            state: 1,
          },
        },
        {
          $setWindowFields: {
            partitionBy: undefined,
            sortBy: { score: -1 },
            output: {
              rank: {
                $rank: {},
              },
            },
          },
        },
        {
          $match: {
            userId: toObjectId(userId),
          },
        },
      ])
      .exec();
  }

  async getRankWithScore(tournamentId: string, score: number): Promise<number> {
    const higherScoreCount =
      await this.ludoMegaTournamentPlayerModel.countDocuments({
        tournamentId: toObjectId(tournamentId),
        score: {
          $gt: score,
        },
      });
    return higherScoreCount + 1;
  }

  async getFinishedGameInfo(tableId: string): Promise<FinishedGameInfo> {
    const tournamentPlayerDocument =
      await this.ludoMegaTournamentPlayerModel.findOne({ tableId });
    if (!tournamentPlayerDocument) {
      throw new NotFoundException(`No table ${tableId}`);
    }
    const { tournamentId, score } = tournamentPlayerDocument;
    return {
      tournamentId: tournamentId.toString(),
      score,
    };
  }

  async getLeaderboardEntryCount(tournamentId: string): Promise<number> {
    return await this.ludoMegaTournamentPlayerModel.countDocuments({
      tournamentId: toObjectId(tournamentId),
    });
  }

  async getPrizes(tournamentId: string): Promise<LudoMegaTournamentPrize[]> {
    return await this.ludoMegaTournamentPlayerModel
      .find(
        {
          tournamentId: toObjectId(tournamentId),
          winAmount: { $ne: '0.00' },
        },
        {
          _id: 0,
          userId: 1,
          winAmount: 1,
          entryNo: 1,
        },
      )
      .lean();
  }

  async markAsCompleted(
    tournamentId: string,
    totalWinAmount: string,
  ): Promise<void> {
    const tournament = await this.ludoMegaTournamentModel.findById(
      tournamentId,
      {
        _id: 0,
        winningPrizes: 1,
        joinFee: 1,
        enteredUserCount: 1,
      },
    );
    if (!tournament) {
      throw new NotFoundException(`Tournament ${tournamentId} not found`);
    }

    const { winningPrizes, joinFee, enteredUserCount } = tournament;

    const totalJoinFee = Big(joinFee).mul(enteredUserCount);

    await Promise.all([
      this.ludoMegaTournamentModel.findByIdAndUpdate(tournamentId, {
        $set: {
          status: LudoMegaTournamentStatus.completed,
          totalWinAmount,
          winningPrizes: this.#updateWinningPrizeAmounts(
            winningPrizes,
            totalJoinFee,
          ),
          endAt: new Date(),
        },
      }),
      this.ludoMegaTournamentPlayerModel.updateMany(
        {
          tournamentId: toObjectId(tournamentId),
        },
        {
          $set: {
            endAt: new Date(),
          },
        },
      ),
    ]);
  }

  async getLudoMegaTournamentHistory(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<Paginated<LudoMegaTournamentHistoryDto>> {
    // Get Ongoing Tournaments
    const ongoingTournaments = await this.ludoMegaTournamentModel
      .find(
        {
          status: {
            $in: [
              LudoMegaTournamentStatus.live,
              LudoMegaTournamentStatus.full,
              LudoMegaTournamentStatus.closed,
            ],
          },
        },
        {
          _id: 1,
        },
      )
      .lean();
    const ongoingTournamentIds = ongoingTournaments.map(({ _id }) => _id);
    const [megaTournamentHistories, totalCount] = await Promise.all([
      this.ludoMegaTournamentPlayerModel
        .find(
          {
            userId: toObjectId(userId),
            tournamentId: { $nin: ongoingTournamentIds },
          },
          {
            _id: 0,
            game: 0,
            tournamentId: 1,
            tournamentName: 1,
            joinFee: 1,
            winAmount: 1,
            score: 1,
            entryNo: 1,
            endAt: 1,
          },
        )
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.ludoMegaTournamentPlayerModel.countDocuments({
        userId: toObjectId(userId),
        tournamentId: { $nin: ongoingTournamentIds },
      }),
    ]);
    const items: LudoMegaTournamentHistoryDto[] = megaTournamentHistories.map(
      ({
        tournamentId,
        tournamentName,
        joinFee,
        winAmount,
        score,
        entryNo,
        endAt,
      }) => ({
        tournamentId,
        tournamentName,
        joinFee,
        winAmount,
        score: Big(score).toFixed(2),
        entryNo,
        endAt: endAt ?? dayjs().toDate(),
      }),
    );
    return {
      items,
      meta: {
        totalCount,
        skip,
        limit: megaTournamentHistories.length,
      },
    };
  }

  async getJoinedUserIds(tournamentId: string): Promise<string[]> {
    const userObjectIds = await this.ludoMegaTournamentPlayerModel.aggregate([
      { $match: { tournamentId: toObjectId(tournamentId) } },
      { $group: { _id: '$userId' } },
      { $project: { userId: '$_id', _id: 0 } },
    ]);
    return userObjectIds.map((userObjectId) => userObjectId.userId.toString());
  }
}
