import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  SpRoundHistory,
  SpRoundHistoryDocument,
  GameHistory,
  GameHistoryDocument,
} from '../models';
import { Model } from 'mongoose';
import {
  Games,
  SPRoundHistoryParameters,
  SpLeaderboardHistoryDto,
  SpRoundHistoryDto,
  SpTableHistoryDto,
} from '@lib/fabzen-common/types';
import { SpGameHistoryRepository } from 'apps/sp-gameplay/src/sp-gameplay.respository';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { SpRoundHistoryResponseDto } from 'apps/rest-api/src/subroutes/history/history.dto';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';

Injectable();
export class MongooseSpGameHistoryRepository
  implements SpGameHistoryRepository
{
  constructor(
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    @InjectModel(SpRoundHistory.name)
    public spRoundHistoryModel: Model<SpRoundHistoryDocument>,
    private userRepository: UserRepository,
  ) {}

  async createTableHistory(newTableHistory: SpTableHistoryDto) {
    const gameHistoryDocument = new this.gameHistoryModel({
      ...newTableHistory,
      game: Games.skillpatti,
    });
    await gameHistoryDocument.save();
  }

  async createLeaderboardHistory(newHistory: SpLeaderboardHistoryDto) {
    const gameHistoryDocument = new this.gameHistoryModel({
      ...newHistory,
      game: Games.skillpatti,
    });
    await gameHistoryDocument.save();
  }

  async createRoundHistory(newRoundHistory: SpRoundHistoryDto) {
    const oldRoundHistory = await this.spRoundHistoryModel.findOne({
      tableId: newRoundHistory.tableId,
      roundNo: newRoundHistory.roundNo,
    });
    let newHistory: SpRoundHistoryDto;
    if (oldRoundHistory) {
      newHistory = {
        tableId: oldRoundHistory.tableId,
        tableType: oldRoundHistory.tableType,
        roundNo: oldRoundHistory.roundNo,
        potAmount: oldRoundHistory.potAmount,
        commissionAmount: oldRoundHistory.commissionAmount,
        tableCard: oldRoundHistory?.tableCard,
        winners: oldRoundHistory.winners,
        userInfo: oldRoundHistory.userInfo,
        roundStartedAt: oldRoundHistory.roundStartedAt,
      };
      for (const item of newRoundHistory.userInfo) {
        const index = newHistory.userInfo.findIndex(
          (userInfo) => userInfo.userId.toString() === item.userId.toString(),
        );
        if (index === -1) {
          newHistory.userInfo.push(item);
        } else {
          newHistory.userInfo[index] = item;
        }
      }
      if (newHistory.winners.length === 0) {
        newHistory.winners = newRoundHistory.winners;
      }
      if (!newHistory?.tableCard) {
        newHistory.tableCard = newRoundHistory?.tableCard;
      }
      if (
        !newHistory?.commissionAmount ||
        newHistory.commissionAmount === '0'
      ) {
        newHistory.commissionAmount = newRoundHistory?.commissionAmount;
      }
      await this.spRoundHistoryModel.updateOne(
        { _id: oldRoundHistory._id },
        {
          ...newHistory,
        },
      );
    } else {
      const spRoundHistoryDocument = new this.spRoundHistoryModel({
        ...newRoundHistory,
      });
      await spRoundHistoryDocument.save();
    }

    for (const userInfo of newRoundHistory.userInfo) {
      const { userId, winLossAmount, outcome } = userInfo;
      this.userRepository.updateUserStats({
        userId: userId.toString(),
        winLoseAmount: Number.parseFloat(winLossAmount),
        outcome,
        game: Games.skillpatti,
      });
      this.createLeaderboardHistory({
        userId,
        tableId: newRoundHistory.tableId,
        roundNo: newRoundHistory.roundNo,
        tableType: newRoundHistory.tableType,
        winLoseAmount: Number.parseFloat(winLossAmount),
        outcome,
      });
    }
  }

  async getRoundHistory(
    historyParameters: SPRoundHistoryParameters,
  ): Promise<SpRoundHistoryResponseDto> {
    const { tableId, skip, limit, userId } = historyParameters;
    const [items, totalCount] = await Promise.all([
      this.spRoundHistoryModel.find(
        {
          tableId,
          'userInfo.userId': toObjectId(userId),
        },
        { 'tableType._id': 0, _id: 0, __v: 0 },
        { skip, limit, sort: { _id: -1 } },
      ),
      this.spRoundHistoryModel.countDocuments({
        tableId,
        'userInfo.userId': toObjectId(userId),
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
}
