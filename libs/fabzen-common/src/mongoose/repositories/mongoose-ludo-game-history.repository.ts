import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { GameHistory, GameHistoryDocument } from '../models';
import { GameOutcome, Games } from '@lib/fabzen-common/types';
import {
  CreateLudoGameHistoryDto,
  GameEndedDto,
} from 'apps/ludo-gameplay/src/ludo-gameplay.types';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';

Injectable();
export class MongooseLudoGameHistoryRepository {
  constructor(
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    private readonly userRepository: UserRepository,
  ) {}

  async creatLudoGameHistory(
    createLudoGameHistoryDto: CreateLudoGameHistoryDto,
  ) {
    const gameDocumentsToAdd = [];
    const { userIds, gameType, tableId, joinFee, roomSize } =
      createLudoGameHistoryDto;
    const userNameProfilePicList =
      await this.userRepository.getUserNameProfilePicList(userIds);

    for (const userId of userIds) {
      const user = userNameProfilePicList.find(
        (user) => user.userId === userId,
      );
      gameDocumentsToAdd.push({
        userId: toObjectId(userId),
        username: user?.name ?? user?.username,
        gameType,
        tableId,
        joinFee,
        winLoseAmount: Number(joinFee),
        outcome: GameOutcome.lost,
        roomSize,
        game: Games.ludo,
      });
    }

    await this.gameHistoryModel.insertMany(gameDocumentsToAdd);
  }

  async updateLudoGameHistory(gameResult: GameEndedDto) {
    const bulkWriteOps: any[] = [];
    const { winners, tableId, winningAmount, losers, joinFee } = gameResult;

    for (const winner of winners) {
      const { userId } = winner;

      bulkWriteOps.push({
        updateOne: {
          filter: { tableId, userId: toObjectId(userId) },
          update: {
            $set: {
              outcome: GameOutcome.won,
              winLoseAmount: Number(winningAmount),
            },
          },
        },
      });

      await this.userRepository.updateUserStats({
        userId,
        winLoseAmount: Number(winningAmount),
        game: Games.ludo,
        outcome: GameOutcome.won,
      });
    }

    for (const loserId of losers) {
      await this.userRepository.updateUserStats({
        userId: loserId,
        winLoseAmount: Number(joinFee),
        game: Games.ludo,
        outcome: GameOutcome.lost,
      });
    }

    await this.gameHistoryModel.bulkWrite(bulkWriteOps);
  }
}
