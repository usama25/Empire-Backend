/* eslint-disable unicorn/no-null */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { AviatorHistoryRepository } from 'apps/aviator-gameplay/src/domain/interfaces/game-history.repository';
import {
  AviatorRoundHistory,
  AviatorRoundHistoryDocument,
  PlayerSeedProfile,
} from '../models/aviator-history.schema';
import {
  AviatorNewRoundHistoryDto,
  AviatorRoundHistoryResponseDto,
  AviatorUserHistoryDto,
  AviatorUserResponseDto,
  AviatorUsersBetHistoryDto,
} from 'apps/aviator-gameplay/src/domain/use-cases';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import {
  GameOutcome,
  Games,
  HistoryParameters,
  UserProfile,
} from '@lib/fabzen-common/types';
import { GameHistory, GameHistoryDocument } from '../models';
import { ROUND_PREFIX } from 'apps/aviator-gameplay/src/infrastructure/repositories/constants';

Injectable();
export class MongooseAviatorHistoryRepository
  implements AviatorHistoryRepository
{
  constructor(
    @InjectModel(AviatorRoundHistory.name)
    public aviatorRoundHistoryModel: Model<AviatorRoundHistoryDocument>,
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    private userRepository: UserRepository,
  ) {}

  async createRoundHistory(
    newRoundHistory: AviatorNewRoundHistoryDto,
  ): Promise<void> {
    const {
      playerSeed1,
      playerSeed2,
      playerSeed3,
      roundNo,
      crashValue,
      serverSeed,
    } = newRoundHistory;
    const players: PlayerSeedProfile[] = [];
    await Promise.all(
      [playerSeed1, playerSeed2, playerSeed3].map(async (playerSeed) => {
        const userId = playerSeed.slice(0, 24);
        const { username, name, avatar } =
          (await this.userRepository.getUserProfile(userId)) as UserProfile;
        players.push({
          userId,
          username: name || username,
          avatar: avatar ?? 1,
          playerSeed,
        });
      }),
    );
    const roundHistoryDocument = new this.aviatorRoundHistoryModel({
      players,
      roundNo,
      crashValue,
      serverSeed,
    });
    await roundHistoryDocument.save();
  }

  async createUserHistory(
    newUserHistory: AviatorUserHistoryDto,
  ): Promise<void> {
    const { userId, roundNo, cashoutAmount, betAmount } = newUserHistory;
    const { username, name, avatar } =
      (await this.userRepository.getUserProfile(
        userId.toString(),
      )) as UserProfile;
    const userHistoryDocument = new this.gameHistoryModel({
      userId: userId,
      tableId: ROUND_PREFIX + roundNo,
      roundNo,
      game: Games.aviator,
      username,
      name,
      avatar: avatar ?? 1,
      outcome: GameOutcome.lost,
      winLoseAmount: betAmount,
      startAmount: betAmount.toString(),
      endAmount: cashoutAmount.toString(),
    });
    await userHistoryDocument.save();
    this.userRepository.updateUserStats({
      userId: userId.toString(),
      winLoseAmount: cashoutAmount,
      outcome: GameOutcome.lost,
      game: Games.aviator,
    });
  }

  async updateRoundHistory(
    roundNo: number,
    crashValue: number,
    serverSeed: string,
  ): Promise<void> {
    const roundProfit = await this.gameHistoryModel.aggregate([
      { $match: { game: Games.aviator, roundNo } },
      {
        $group: {
          _id: null,
          profit: { $sum: { $subtract: ['$betAmount', '$cashoutAmount'] } },
        },
      },
    ]);
    await this.aviatorRoundHistoryModel.findOneAndUpdate(
      { roundNo },
      { $set: { crashValue, serverSeed, profit: roundProfit[0].profit } },
    );
  }

  async updateUserHistory(
    userId: string,
    roundNo: number,
    cashoutAmount: number,
    betAmount: number,
  ): Promise<void> {
    await this.gameHistoryModel.findOneAndUpdate(
      { userId: toObjectId(userId), roundNo, game: Games.aviator },
      {
        $set: {
          winLoseAmount: cashoutAmount - betAmount,
          outcome: cashoutAmount === 0 ? GameOutcome.lost : GameOutcome.won,
          endAmount: cashoutAmount.toString(),
          updatedAt: new Date(),
        },
      },
    );
    this.userRepository.updateUserStats({
      userId,
      winLoseAmount: cashoutAmount,
      outcome: cashoutAmount === 0 ? GameOutcome.lost : GameOutcome.won,
      game: Games.aviator,
    });
  }

  async getUserHistory(
    historyParameters: HistoryParameters,
  ): Promise<AviatorUserResponseDto> {
    const { userId, skip, limit } = historyParameters;
    const userHistory = await this.gameHistoryModel
      .find({ userId: toObjectId(userId), game: Games.aviator })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit);
    const userHistoryResult = [];
    for (const history of userHistory) {
      const { startAmount, endAmount, createdAt, roundNo } = history;
      const roundHistory = await this.aviatorRoundHistoryModel.findOne({
        roundNo,
      });
      userHistoryResult.push({
        createdAt,
        betAmount: Number(startAmount),
        multiplierValue: Number(
          (Number(endAmount) / Number(startAmount)).toFixed(2),
        ),
        cashoutAmount: Number(endAmount),
        roundNo,
        crashValue: roundHistory?.crashValue || 0,
      });
    }
    return {
      history: userHistoryResult,
      meta: {
        totalCount: userHistoryResult.length,
        skip,
        limit,
      },
    };
  }

  async getCurrentRoundPlayers(
    roundNo: number,
  ): Promise<AviatorUsersBetHistoryDto[]> {
    const userHistory = await this.gameHistoryModel.find({
      game: Games.aviator,
      roundNo,
    });
    return userHistory.map(
      ({ userId, username, name, startAmount, endAmount, avatar }) => ({
        userId: userId.toString(),
        username: name || username,
        betAmount: Number(startAmount),
        cashoutAmount: Number(endAmount),
        avatar,
      }),
    );
  }

  async getRoundHistory(
    skip: number,
    limit: number,
  ): Promise<AviatorRoundHistoryResponseDto> {
    const roundHistory = await this.aviatorRoundHistoryModel
      .find({})
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit);
    const history = roundHistory.map(
      ({ roundNo, crashValue, serverSeed, players, createdAt }) => ({
        roundNo,
        crashValue,
        serverSeed,
        players,
        createdAt,
      }),
    );
    return {
      history,
      meta: {
        totalCount: history.length,
        skip,
        limit,
      },
    };
  }
}
