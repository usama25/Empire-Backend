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
  SpRoundHistoryDto,
  SpTableHistoryDto,
  UserInfo,
} from '@lib/fabzen-common/types';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { ReRoundHistoryResponseDto } from 'apps/rest-api/src/subroutes/history/history.dto';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { ReGameHistoryRepository } from 'apps/re-gameplay/src/re-gameplay.repository';
import {
  ReRoundHistoryDto,
  ReTableHistoryDto,
  ReUserInfo,
} from 'apps/re-gameplay/src/re-gameplay.types';
import { ReRoundHistory, ReRoundHistoryDocument } from '../models';

Injectable();
export class MongooseReGameHistoryRepository
  implements ReGameHistoryRepository
{
  constructor(
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    @InjectModel(SpRoundHistory.name)
    public spRoundHistoryModel: Model<SpRoundHistoryDocument>,
    @InjectModel(ReRoundHistory.name)
    public reRoundHistoryModel: Model<ReRoundHistoryDocument>,
    private userRepository: UserRepository,
  ) {}

  async createTableHistory(newTableHistory: SpTableHistoryDto) {
    const gameHistoryDocument = new this.gameHistoryModel({
      ...newTableHistory,
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
      const newUserInfo: UserInfo[] = [];
      oldRoundHistory.userInfo.map((user) => newUserInfo.push(user));
      newHistory = {
        tableId: oldRoundHistory.tableId,
        tableType: oldRoundHistory.tableType,
        roundNo: oldRoundHistory.roundNo,
        potAmount: oldRoundHistory.potAmount,
        commissionAmount: oldRoundHistory.commissionAmount,
        tableCard: oldRoundHistory?.tableCard,
        winners: oldRoundHistory.winners,
        userInfo: newUserInfo,
        roundStartedAt: oldRoundHistory.roundStartedAt,
      };
      await Promise.all(
        newRoundHistory.userInfo.map((item) => {
          let flag = false;
          for (let index = 0; index < newHistory.userInfo.length; index++) {
            if (newHistory.userInfo[index].userId === item.userId) {
              flag = true;
            } else {
              continue;
            }
          }
          if (!flag) {
            newHistory.userInfo.push(item);
          }
          return 0;
        }),
      );
      if (newHistory.winners.length === 0) {
        newHistory.winners = newRoundHistory.winners;
      }
      if (!newHistory?.tableCard) {
        newHistory.tableCard = newRoundHistory?.tableCard;
      }
      await oldRoundHistory.updateOne({
        ...newHistory,
      });
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
    }
  }

  async createReTableHistory(newTableHistory: ReTableHistoryDto) {
    const gameHistoryDocument = new this.gameHistoryModel({
      ...newTableHistory,
      game: Games.rummyempire,
    });

    console.log('Rummy Game History Document', gameHistoryDocument);
    await gameHistoryDocument.save();
  }

  async createReRoundHistory(newRoundHistory: ReRoundHistoryDto) {
    const oldRoundHistory = await this.reRoundHistoryModel.findOne({
      tableId: newRoundHistory.tableId,
      roundId: newRoundHistory.roundId,
    });
    let newHistory: ReRoundHistoryDto;
    if (oldRoundHistory) {
      const newUserInfo: ReUserInfo[] = [];
      oldRoundHistory.userInfo.map((user) => newUserInfo.push(user));
      newHistory = {
        tableId: oldRoundHistory.tableId,
        tableType: oldRoundHistory.tableType,
        joinFee: oldRoundHistory.joinFee,
        roundId: oldRoundHistory.roundId,
        commissionAmount: oldRoundHistory.commissionAmount,
        wildCard: oldRoundHistory.wildCard,
        winner: oldRoundHistory.winner,
        userInfo: newUserInfo,
        roundStartedAt: oldRoundHistory.roundStartedAt,
      };
      await Promise.all(
        newRoundHistory.userInfo.map((item) => {
          let flag = false;
          for (let index = 0; index < newHistory.userInfo.length; index++) {
            if (newHistory.userInfo[index].userId === item.userId) {
              flag = true;
            } else {
              continue;
            }
          }
          if (!flag) {
            newHistory.userInfo.push(item);
          }
          return 0;
        }),
      );
      await oldRoundHistory.updateOne({
        ...newHistory,
      });
    } else {
      const reRoundHistoryDocument = new this.reRoundHistoryModel({
        ...newRoundHistory,
      });
      await reRoundHistoryDocument.save();

      console.log('ReRoundHistoryDocument', reRoundHistoryDocument);
    }

    for (const userInfo of newRoundHistory.userInfo) {
      const { userId, winLossAmount, outcome } = userInfo;
      this.userRepository.updateUserStats({
        userId: userId.toString(),
        winLoseAmount: Number.parseFloat(winLossAmount),
        outcome,
        game: Games.rummyempire,
      });
    }
  }

  async getRoundHistory(
    historyParameters: SPRoundHistoryParameters,
  ): Promise<ReRoundHistoryResponseDto> {
    const { tableId, skip, limit, userId } = historyParameters;
    const [items, totalCount] = await Promise.all([
      this.reRoundHistoryModel.find(
        {
          tableId,
          'userInfo.userId': toObjectId(userId),
        },
        { 'tableType._id': 0, _id: 0, __v: 0 },
        { skip, limit, sort: { _id: -1 } },
      ),
      this.reRoundHistoryModel.countDocuments({
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
