import { SLGameMongooseRepository } from 'apps/sl-gameplay/src/domain/interfaces';

import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { PlayerId, SLGameTable } from 'apps/sl-gameplay/src/domain/entities';
import {
  User,
  Counter,
  UserDocument,
  CounterDocument,
} from '@lib/fabzen-common/mongoose/models/user.schema';

import { Leaderboard, LeaderboardDocument } from '../models/leaderboard.schema';
import {
  GameOutcome,
  Games,
  HistoryParameters,
  SLRoundHistoryParameters,
} from '@lib/fabzen-common/types';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { GameHistory, GameHistoryDocument } from '../models';
import {
  SLGameHistoryResponseDto,
  SLGameHistoryDto,
  SLRoundGameHistoryDto,
  SLRoundHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/history/history.dto';

export class MongooseSLGameRepository implements SLGameMongooseRepository {
  constructor(
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    @InjectModel(User.name)
    public userModel: Model<UserDocument>,
    private readonly userRepository: UserRepository,
    @InjectModel(Leaderboard.name)
    public leaderboardModel: Model<LeaderboardDocument>,
    @InjectModel(Counter.name)
    public counterModel: Model<CounterDocument>,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  #getPlayerId(index: number): PlayerId {
    return `PL${index + 1}` as PlayerId;
  }

  #getId(userIds: string[], userId: string) {
    const index = userIds.indexOf(userId);
    return index;
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

  async getSLGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<SLGameHistoryResponseDto> {
    const { items, meta } = await this.#getRecords(
      historyParameters,
      Games.snakeAndLadders,
    );
    const history: SLGameHistoryDto[] = items.map((item) => ({
      tableId: item.tableId,
      joinFee: item.joinFee,
      winLoseAmount: item.winLoseAmount.toString(),
      roomSize: item.roomSize,
      outcome: item.outcome,
      totalScore: item.totalScore,
      startedAt: item.startedAt ?? item._id.getTimestamp(),
      createdAt: item.createdAt,
    }));
    return {
      history,
      meta,
    };
  }

  async getRoundHistory(
    historyParameters: SLRoundHistoryParameters,
  ): Promise<SLRoundHistoryResponseDto> {
    const { tableId, skip, limit, userId } = historyParameters;
    const game = Games.snakeAndLadders;

    const [items, totalCount] = await Promise.all([
      this.gameHistoryModel.find(
        { tableId: tableId, game },
        { 'tableType._id': 0 },
        { skip, limit, sort: { _id: -1 } },
      ),
      this.gameHistoryModel.countDocuments({
        userId: toObjectId(userId),
        game,
      }),
    ]);
    const history: SLRoundGameHistoryDto[] = items.map((item) => ({
      userId: item.userId.toString(),
      tableId: item.tableId,
      joinFee: item.joinFee,
      winLoseAmount: item.winLoseAmount.toString(),
      roomSize: item.roomSize,
      outcome: item.outcome,
      totalScore: item.totalScore,
      startedAt: item.startedAt ?? item._id.getTimestamp(),
      createdAt: item.createdAt,
    }));
    return {
      history,
      meta: {
        totalCount,
        skip,
        limit: Math.min(totalCount, limit),
      },
    };
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

  public getSum(score: number[]) {
    let sum: number = 0;
    for (const value of score) {
      sum += value;
    }
    return sum;
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

  async createSLGameHistory(
    table: SLGameTable,
    leftUserId?: string,
  ): Promise<boolean> {
    if (leftUserId) {
      const users = table.users;
      const userIds = users.map((user) => user.userId);
      const tableId = table.id;
      const joinFee = table.joinFee;
      const roomSize = users.length;
      const startedAt = table.startedAt;
      const numberOfWinners = this.getNumberOfWinners(table);
      const winAmount = Number(table.winAmount) / numberOfWinners;
      const userNameProfilePicList =
        await this.userRepository.getUserNameProfilePicList(userIds);
      const user = userNameProfilePicList.find(
        (user) => user.userId === leftUserId,
      );
      const userIndex = userIds.indexOf(leftUserId);
      const isWinner =
        this.isWinner(
          table,
          this.getSum(table.calculateTotalPointsOfMyPawns(userIndex)),
        ) && !users[userIndex].didLeave;
      // update stats for SL
      this.userRepository.updateUserStats({
        userId: leftUserId.toString(),
        winLoseAmount: isWinner ? winAmount : Number(table.joinFee),
        outcome: isWinner ? GameOutcome.won : GameOutcome.lost,
        game: Games.snakeAndLadders,
      });

      const gameDocumentsToAdd = new this.gameHistoryModel({
        userId: toObjectId(leftUserId),
        username: user?.name ?? user?.username,
        tableId,
        joinFee,
        playerId: this.#getPlayerId(this.#getId(userIds, leftUserId)),
        totalScore: this.getTotalScore(table, leftUserId),
        winLoseAmount: isWinner ? winAmount : Number(table.joinFee),
        outcome: isWinner ? GameOutcome.won : GameOutcome.lost,
        roomSize,
        game: Games.snakeAndLadders,
        startedAt: startedAt,
      });

      await gameDocumentsToAdd.save();
    } else {
      const users = table.users;
      const currentUserIds = users
        .filter((user) => user.didLeave === false)
        .map((user) => user.userId);
      const allUserIds = users.map((user) => user.userId);
      const tableId = table.id;
      const joinFee = table.joinFee;
      const roomSize = users.length;
      const startedAt = table.startedAt;
      const numberOfWinners = this.getNumberOfWinners(table);
      const winAmount = Number(table.winAmount) / numberOfWinners;
      const userNameProfilePicList =
        await this.userRepository.getUserNameProfilePicList(currentUserIds);
      for (const userId of currentUserIds) {
        const user = userNameProfilePicList.find(
          (user) => user.userId === userId,
        );
        const userIndex = allUserIds.indexOf(userId);
        const isWinner =
          this.isWinner(
            table,
            this.getSum(table.calculateTotalPointsOfMyPawns(userIndex)),
          ) && !users[userIndex].didLeave;
        // update stats for SL
        this.userRepository.updateUserStats({
          userId: userId.toString(),
          winLoseAmount: isWinner ? winAmount : Number(table.joinFee),
          outcome: isWinner ? GameOutcome.won : GameOutcome.lost,
          game: Games.snakeAndLadders,
        });

        const gameDocumentsToAdd = new this.gameHistoryModel({
          userId: toObjectId(userId),
          username: user?.name ?? user?.username,
          tableId,
          joinFee,
          playerId: this.#getPlayerId(this.#getId(allUserIds, userId)),
          totalScore: this.getTotalScore(table, userId),
          winLoseAmount: isWinner ? winAmount : Number(table.joinFee),
          outcome: isWinner ? GameOutcome.won : GameOutcome.lost,
          roomSize,
          game: Games.snakeAndLadders,
          startedAt: startedAt,
        });

        await gameDocumentsToAdd.save();
      }
    }

    return true;
  }

  public getTotalScore(gameTable: SLGameTable, userId: string): string {
    const users = gameTable.users;
    const userIndex = users.findIndex((user) => user.userId === userId);
    const score = gameTable.calculateTotalPointsOfMyPawns(userIndex);
    return this.getSum(score).toString();
  }
}
