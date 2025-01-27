import * as dayjs from 'dayjs';
import { Model, Types } from 'mongoose';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  GameHistory,
  GameHistoryDocument,
  User,
  UserDocument,
} from '../models';
import { Leaderboard, LeaderboardDocument } from '../models/leaderboard.schema';
import { SpRoundHistory, SpRoundHistoryDocument } from '../models';
import { CbrGameHistoryRepository } from 'apps/cbr-gameplay/src/cbr-gameplay.repository';
import {
  CbrHistoryDto,
  DWM,
  GameOutcome,
  Games,
  HistoryParameters,
  LeaderboardRequest,
  ScoreboardRequest,
} from '@lib/fabzen-common/types';
import {
  CbrGameHistoryDto,
  CbrHistoryResponseDto,
  CbrPlayer,
  LeaderboardItemDto,
  LeaderboardResponseDto,
  LudoHistoryDto,
  LudoHistoryResponseDto,
  ReTableHistoryDto,
  ReTableHistoryResponseDto,
  ScoreboardResponseDto,
  SpTableHistoryDto,
  SpTableHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/history/history.dto';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { config } from '@lib/fabzen-common/configuration';

type AggregatedUserGameHistory = {
  _id: Types.ObjectId;
  playedGames: number;
  winAmount: number;
  username: string;
  avatar: number;
};

type LeaderboardDto = {
  _id: string;
  rank: number;
  userId: string;
  playedGames: number;
  winAmount: string;
  username: string;
  game: Games;
  avatar: number;
  dwm: DWM;
};

type BulkWriteOp =
  | { insertOne: { document: Omit<LeaderboardDto, '_id'> } }
  | { deleteMany: { filter: Record<string, string> } };

Injectable();
export class MongooseCbrGameHistoryRepository
  implements CbrGameHistoryRepository
{
  constructor(
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    @InjectModel(Leaderboard.name)
    public leaderboardModel: Model<LeaderboardDocument>,
    @InjectModel(SpRoundHistory.name)
    public spRoundHistoryModel: Model<SpRoundHistoryDocument>,
    @InjectModel(User.name)
    public userModel: Model<UserDocument>,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  async createCbrHistory(newTableHistory: CbrHistoryDto) {
    Promise.all(
      newTableHistory.players.map(async (player) => {
        const cbrHistoryDocument = new this.gameHistoryModel({
          tableId: newTableHistory.tableId,
          joinFee: newTableHistory.joinFee,
          startedAt: newTableHistory.startedAt,
          totalRounds: newTableHistory.totalRounds,
          game: Games.callbreak,
          ...player,
        });
        await cbrHistoryDocument.save();
      }),
    );
  }

  async getCbrHistory(
    historyParameters: HistoryParameters,
  ): Promise<CbrHistoryResponseDto> {
    const { items, meta } = await this.#getRecords(
      historyParameters,
      Games.callbreak,
    );
    const history: CbrGameHistoryDto[] = items.map((item) => ({
      tableId: item.tableId,
      joinFee: item.joinFee,
      winLoseAmount: item.winLoseAmount,
      outcome: item.outcome,
      active: item.active,
      startedAt: item.startedAt ?? item._id.getTimestamp(),
      endedAt: item._id.getTimestamp(),
    }));
    return {
      history,
      meta,
    };
  }

  async getLudoHistory(
    historyParameters: HistoryParameters,
  ): Promise<LudoHistoryResponseDto> {
    const { items, meta } = await this.#getRecords(
      historyParameters,
      Games.ludo,
    );
    const history: LudoHistoryDto[] = items.map(
      ({
        tableId,
        joinFee,
        gameType,
        winLoseAmount,
        roomSize,
        createdAt,
        outcome,
      }) => ({
        tableId,
        joinFee,
        gameType,
        winLoseAmount,
        roomSize,
        outcome,
        createdAt,
      }),
    );
    return {
      history,
      meta,
    };
  }

  async getSpHistory(
    historyParameters: HistoryParameters,
  ): Promise<SpTableHistoryResponseDto> {
    const { items, meta } = await this.#getRecords(
      historyParameters,
      Games.skillpatti,
    );
    const history: SpTableHistoryDto[] = [];
    items
      .filter((history) => !history.roundNo)
      .map((item) => {
        history.push({
          tableId: item.tableId,
          tableType: item.tableType,
          startAmount: item.startAmount,
          endAmount: item.endAmount,
          createdAt: item.createdAt,
        });
      });
    return {
      history,
      meta,
    };
  }

  async getReHistory(
    historyParameters: HistoryParameters,
  ): Promise<ReTableHistoryResponseDto> {
    const { items, meta } = await this.#getRecords(
      historyParameters,
      Games.rummyempire,
    );
    const history: ReTableHistoryDto[] = [];
    items.map((item) => {
      history.push({
        tableId: item.tableId,
        tableType: item.tableReType,
        startAmount: item.startAmount,
        endAmount: item.endAmount,
        createdAt: item.createdAt,
      });
    });
    return {
      history,
      meta,
    };
  }

  async getScoreboard(
    scoreboardRequest: ScoreboardRequest,
  ): Promise<ScoreboardResponseDto> {
    const { tableId } = scoreboardRequest;
    const documents = await this.gameHistoryModel.find({
      tableId,
      game: Games.callbreak,
    });
    if (documents.length === 4) {
      const scoreboard: CbrPlayer[] = [];
      documents.map((document) => {
        const player: CbrPlayer = {
          playerId: document.playerId,
          username: document.username,
          name: document.name,
          totalScore: document.totalScore,
          avatar: document.avatar,
          scores: document.scores,
          active: document.active,
        };
        scoreboard.push(player);
      });
      return {
        joinFee: documents[0].joinFee,
        tableId: documents[0].tableId,
        startedAt: documents[0].startedAt,
        endedAt: documents[0]._id.getTimestamp(),
        scoreboard,
      };
    } else if (documents.length === 0) {
      throw new BadRequestException(
        'Game is still ongoing please check leaderboard after sometime',
      );
    } else {
      throw new BadRequestException('Invalid Table ID');
    }
  }

  async getLeaderboard(
    leaderboardRequest: LeaderboardRequest,
  ): Promise<LeaderboardResponseDto> {
    const { items, meta, myPlayer } =
      await this.#getLeaderboardRecords(leaderboardRequest);
    const history: LeaderboardItemDto[] = items.map(
      ({ username, avatar, rank, playedGames, winAmount }) => ({
        username,
        avatar,
        rank,
        playedGames,
        winAmount,
      }),
    );
    return {
      history,
      meta,
      myPlayer,
    };
  }

  async #getRecords(historyParameters: HistoryParameters, game: Games) {
    const { userId, skip, limit } = historyParameters;

    const [items, totalCount] = await Promise.all([
      this.gameHistoryModel.find(
        { userId: toObjectId(userId), game },
        { 'tableType._id': 0 },
        { skip, limit, sort: { _id: -1 } },
      ),
      this.gameHistoryModel.countDocuments({
        userId: toObjectId(userId),
        game,
      }),
    ]);
    return {
      items,
      meta: {
        totalCount,
        skip,
        limit: Math.min(totalCount, limit),
      },
    };
  }

  async #getLeaderboardRecords(leaderboardRequest: LeaderboardRequest) {
    const { skip, limit, game, dwm, userId } = leaderboardRequest;
    const [items, totalCount, myLeaderboard] = await Promise.all([
      this.leaderboardModel.find(
        { game, dwm },
        {
          _id: 0,
          username: 1,
          avatar: 1,
          rank: 1,
          playedGames: 1,
          winAmount: 1,
        },
        { skip, limit, sort: { rank: 1 } },
      ),
      this.leaderboardModel.countDocuments({
        game,
        dwm,
      }),
      this.leaderboardModel.findOne(
        {
          userId,
          game: Games.empiregames,
          dwm,
        },
        {
          _id: 0,
          username: 1,
          avatar: 1,
          rank: 1,
          playedGames: 1,
          winAmount: 1,
        },
      ),
    ]);

    let myPlayer: LeaderboardItemDto;

    if (myLeaderboard) {
      myPlayer = {
        username: myLeaderboard.username,
        avatar: myLeaderboard.avatar,
        rank: myLeaderboard.rank,
        playedGames: myLeaderboard.playedGames,
        winAmount: myLeaderboard.winAmount,
      };
    } else {
      const myUser = await this.userModel.findById(userId, {
        _id: 0,
        name: 1,
        username: 1,
        avatar: 1,
      });
      if (!myUser) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      myPlayer = {
        username: myUser.name || myUser.username,
        avatar: myUser.avatar,
        rank: totalCount + 1,
        playedGames: 0,
        winAmount: '0.00',
      };
    }

    return {
      items,
      myPlayer: myPlayer ?? {},
      meta: {
        totalCount,
        skip,
        limit: Math.min(totalCount, limit),
      },
    };
  }

  async updateDayLeaderboard(): Promise<void> {
    // await this.#updateDayLeaderboard(Games.callbreak);
    // await this.#updateDayLeaderboard(Games.ludo);
    // await this.#updateDayLeaderboard(Games.skillpatti);
    await this.#updateDayLeaderboard(Games.empiregames);
  }

  async updateWeekLeaderboard(): Promise<void> {
    // await this.#updateWeekLeaderboard(Games.callbreak);
    // await this.#updateWeekLeaderboard(Games.ludo);
    // await this.#updateWeekLeaderboard(Games.skillpatti);
    await this.#updateWeekLeaderboard(Games.empiregames);
  }

  async updateMonthLeaderboard(): Promise<void> {
    // await this.#updateMonthLeaderboard(Games.callbreak);
    // await this.#updateMonthLeaderboard(Games.ludo);
    // await this.#updateMonthLeaderboard(Games.skillpatti);
    await this.#updateMonthLeaderboard(Games.empiregames);
  }

  async #updateDayLeaderboard(game: Games) {
    let records;
    if (game === Games.skillpatti) {
      records = await this.#aggregateSkillpattiGameHistory(
        dayjs().subtract(1, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
      );
    } else if (game === Games.empiregames) {
      records = await this.#aggregateEmpireGameHistory(
        dayjs().subtract(1, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
      );
    } else {
      records = await this.#aggregateCbrAndLudoGameHistory(
        dayjs().subtract(1, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
        game,
      );
    }
    // Prepare leaderboard for bulkWrite
    const leaderboardBulkOperations: BulkWriteOp[] = [
      { deleteMany: { filter: { game, dwm: DWM.day } } },
    ];

    for (const [index, record] of records.entries()) {
      leaderboardBulkOperations.push({
        insertOne: {
          document: {
            rank: index + 1,
            userId: record._id.toString(),
            playedGames: record.playedGames,
            winAmount: record.winAmount.toFixed(2),
            username: record.username,
            avatar: record.avatar,
            game,
            dwm: DWM.day,
          },
        },
      });
    }
    await this.leaderboardModel.bulkWrite(leaderboardBulkOperations);
  }

  async #updateWeekLeaderboard(game: Games) {
    let records;
    if (game === Games.skillpatti) {
      records = await this.#aggregateSkillpattiGameHistory(
        dayjs().subtract(7, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
      );
    } else if (game === Games.empiregames) {
      records = await this.#aggregateEmpireGameHistory(
        dayjs().subtract(7, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
      );
    } else {
      records = await this.#aggregateCbrAndLudoGameHistory(
        dayjs().subtract(7, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
        game,
      );
    }
    // Prepare leaderboard for bulkWrite
    const leaderboardBulkOperations: BulkWriteOp[] = [
      { deleteMany: { filter: { game, dwm: DWM.week } } },
    ];

    for (const [index, record] of records.entries()) {
      leaderboardBulkOperations.push({
        insertOne: {
          document: {
            rank: index + 1,
            userId: record._id.toString(),
            playedGames: record.playedGames,
            winAmount: record.winAmount.toFixed(2),
            username: record.username,
            avatar: record.avatar,
            game,
            dwm: DWM.week,
          },
        },
      });
    }
    await this.leaderboardModel.bulkWrite(leaderboardBulkOperations);
  }

  async #updateMonthLeaderboard(game: Games) {
    let records;
    if (game === Games.skillpatti) {
      records = await this.#aggregateSkillpattiGameHistory(
        dayjs().subtract(28, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
      );
    } else if (game === Games.empiregames) {
      records = await this.#aggregateEmpireGameHistory(
        dayjs().subtract(28, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
      );
    } else {
      records = await this.#aggregateCbrAndLudoGameHistory(
        dayjs().subtract(28, 'day').unix() * 1000,
        dayjs().subtract(1, 'millisecond').unix() * 1000,
        game,
      );
    }
    // Prepare leaderboard for bulkWrite
    const leaderboardBulkOperations: BulkWriteOp[] = [
      { deleteMany: { filter: { game, dwm: DWM.month } } },
    ];

    for (const [index, record] of records.entries()) {
      leaderboardBulkOperations.push({
        insertOne: {
          document: {
            rank: index + 1,
            userId: record._id.toString(),
            playedGames: record.playedGames,
            winAmount: record.winAmount.toFixed(2),
            username: record.username,
            avatar: record.avatar,
            game,
            dwm: DWM.month,
          },
        },
      });
    }
    await this.leaderboardModel.bulkWrite(leaderboardBulkOperations);
  }

  async #aggregateCbrAndLudoGameHistory(
    startDate: number, // Unix timestamp in miliseconds
    endDate: number, // Unix timestamp in miliseconds
    game: Games,
  ): Promise<AggregatedUserGameHistory[]> {
    const leaderboards = await this.gameHistoryModel.aggregate([
      // Filter records using valid date range
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
          game: {
            $eq: game,
          },
        },
      },
      // Exclude amount from records with Lost status
      {
        $addFields: {
          winAmount: {
            $cond: [
              { $eq: ['$outcome', GameOutcome.won] },
              '$winLoseAmount',
              0,
            ],
          },
        },
      },
      // Aggregate the records using $userId
      {
        $group: {
          _id: '$userId',
          playedGames: { $sum: 1 },
          winAmount: {
            $sum: { $convert: { input: '$winAmount', to: 'double' } },
          },
        },
      },
      // Rank the users based on winAmount
      { $sort: { winAmount: -1 } },
      { $limit: config.gameHistory.leaderboard.maxEntries },
    ]);

    return await this.#attachUserNameAvatar(leaderboards);
  }

  async #aggregateSkillpattiGameHistory(
    startDate: number, // Unix timestamp in miliseconds
    endDate: number, // Unix timestamp in miliseconds
  ): Promise<AggregatedUserGameHistory[]> {
    const leaderboards = await this.spRoundHistoryModel.aggregate([
      // Filter records using valid date range
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      {
        $unwind: '$userInfo',
      },
      // Exclude amount from records with Lost status
      {
        $addFields: {
          winAmount: {
            $cond: [
              { $eq: ['$userInfo.outcome', GameOutcome.won] },
              '$userInfo.winLossAmount',
              '0',
            ],
          },
        },
      },
      // Aggregate the records using $userId
      {
        $group: {
          _id: '$userInfo.userId',
          playedGames: { $sum: 1 },
          winAmount: {
            $sum: { $toDouble: '$winAmount' },
          },
        },
      },
      // Rank the users based on winAmount
      { $sort: { winAmount: -1 } },
      { $limit: config.gameHistory.leaderboard.maxEntries },
    ]);

    return await this.#attachUserNameAvatar(leaderboards);
  }

  async #aggregateEmpireGameHistory(
    startDate: number, // Unix timestamp in miliseconds
    endDate: number, // Unix timestamp in miliseconds
  ): Promise<AggregatedUserGameHistory[]> {
    const leaderboards = await this.gameHistoryModel.aggregate([
      // Filter records using valid date range
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      // Exclude amount from records with Lost status
      {
        $addFields: {
          winAmount: {
            $cond: [
              { $eq: ['$outcome', GameOutcome.won] },
              '$winLoseAmount',
              0,
            ],
          },
        },
      },
      // Aggregate the records using $userId
      {
        $group: {
          _id: '$userId',
          playedGames: { $sum: 1 },
          winAmount: {
            $sum: { $convert: { input: '$winAmount', to: 'double' } },
          },
        },
      },
      // Rank the users based on winAmount
      { $sort: { winAmount: -1 } },
      { $limit: config.gameHistory.leaderboard.maxEntries },
    ]);

    return await this.#attachUserNameAvatar(leaderboards);
  }

  async #attachUserNameAvatar(
    leaderboards: AggregatedUserGameHistory[],
  ): Promise<AggregatedUserGameHistory[]> {
    const userIds = leaderboards.map(({ _id }) => _id);
    const users = await this.userModel.find(
      { _id: { $in: userIds } },
      { avatar: 1, name: 1, username: 1 },
    );
    for (const leaderboard of leaderboards) {
      const user = users.find(
        ({ _id }) => _id.toString() === leaderboard._id.toString(),
      );
      leaderboard.username = user?.name ?? user?.username ?? 'Deleted User';
      leaderboard.avatar = user?.avatar ?? 1;
    }
    return leaderboards;
  }
}
