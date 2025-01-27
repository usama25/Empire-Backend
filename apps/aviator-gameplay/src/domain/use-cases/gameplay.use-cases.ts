import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserID } from '@lib/fabzen-common/types';
import * as dayjs from 'dayjs';
import * as crypto from 'node:crypto';
import Big from 'big.js';

import { AviatorRoundRepository, WalletServiceGateway } from '../interfaces';
import { RoundStatus } from './';
import {
  MAX_MULTIPLIER,
  PLAYER_SEED_1,
  PLAYER_SEED_2,
  PLAYER_SEED_3,
  ROUND_START_TIMEOUT,
} from '../../infrastructure/repositories/constants';
import { AviatorHistoryRepository } from '../interfaces/game-history.repository';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';

@Injectable()
export class AviatorGameplayUseCases {
  private readonly logger = new Logger(AviatorGameplayUseCases.name);

  constructor(
    private readonly walletServiceGateway: WalletServiceGateway,
    private readonly aviatorRoundRepository: AviatorRoundRepository,
    private readonly aviatorHistoryRepository: AviatorHistoryRepository,
    private eventEmitter: EventEmitter2,
  ) {}

  async bet(userId: string, amount: string) {
    this.logger.log(`User ${userId} is betting ${amount}`);
    try {
      const { roundNo, roundStatus } =
        await this.aviatorRoundRepository.getCurrentRoundInfo();

      const betRoundNo =
        roundStatus === RoundStatus.ended ? roundNo + 1 : roundNo;
      const userBetAmount = await this.aviatorRoundRepository.getBetInfo(
        betRoundNo,
        userId,
      );
      if (userBetAmount) {
        throw new BadRequestException('User has already placed bet');
      }

      const betUsers =
        await this.aviatorRoundRepository.getBetUsers(betRoundNo);
      switch (betUsers.length) {
        case 0: {
          this.generatePlayerSeed(PLAYER_SEED_1, userId);
          this.generatePlayerSeed(PLAYER_SEED_2, userId);
          this.generatePlayerSeed(PLAYER_SEED_3, userId);
          break;
        }
        case 1: {
          this.generatePlayerSeed(PLAYER_SEED_2, userId);
          this.generatePlayerSeed(PLAYER_SEED_3, userId);
          break;
        }
        case 2: {
          this.generatePlayerSeed(PLAYER_SEED_3, userId);
          break;
        }
        // No default
      }

      await this.debitBetAmount(betRoundNo, userId, amount);
      await this.aviatorRoundRepository.playerBet(betRoundNo, userId, amount);
      await this.aviatorHistoryRepository.createUserHistory({
        userId: toObjectId(userId),
        roundNo: betRoundNo,
        betAmount: Number(amount),
        cashoutAmount: 0,
      });
      if (roundStatus === RoundStatus.ended) {
        await this.startRound();
      }
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException(error.message);
    }
  }

  async startRound() {
    const { roundNo, roundStatus } =
      await this.aviatorRoundRepository.getCurrentRoundInfo();

    const roundLock = await this.aviatorRoundRepository.getRoundlock();
    if (roundLock || roundStatus !== RoundStatus.ended) {
      this.logger.log(`Round already started ${roundNo + 1}`);
      return;
    }
    await this.aviatorRoundRepository.setRoundlock(true);

    await this.aviatorRoundRepository.initializeRound(roundNo);
    this.logger.log(`Starting new round ${roundNo + 1}`);
    const roundStartTime = dayjs().add(ROUND_START_TIMEOUT, 'seconds').toDate();
    await this.aviatorRoundRepository.setCurrentRoundInfo({
      roundNo: roundNo + 1,
      roundStartTime,
      roundStatus: RoundStatus.waiting,
    });
    this.eventEmitter.emit('roundStarted', roundNo + 1, roundStartTime);
    const { playerSeed1, playerSeed2, playerSeed3 } =
      await this.generateGameResult();
    await this.aviatorHistoryRepository.createRoundHistory({
      roundNo: roundNo + 1,
      serverSeed: 'serverSeed',
      playerSeed1,
      playerSeed2,
      playerSeed3,
      crashValue: 0,
    });
    await this.aviatorRoundRepository.setRoundlock(false);
  }

  // get the game result using Probably Fair Algorithm
  async generateGameResult() {
    const serverSeed = crypto.randomBytes(16).toString('hex');
    const serverSeedHash = crypto
      .createHash('sha256')
      .update(serverSeed)
      .digest('hex');
    const playerSeed1 =
      (await this.aviatorRoundRepository.getPlayerSeed(PLAYER_SEED_1)) || '';
    const playerSeed2 =
      (await this.aviatorRoundRepository.getPlayerSeed(PLAYER_SEED_2)) || '';
    const playerSeed3 =
      (await this.aviatorRoundRepository.getPlayerSeed(PLAYER_SEED_3)) || '';

    await this.aviatorRoundRepository.setServerSeed(serverSeed);

    const gameSeed = serverSeed + playerSeed1 + playerSeed2 + playerSeed3;
    const hash = crypto.createHash('sha512').update(gameSeed).digest('hex');
    const hashHmac = crypto
      .createHmac('sha256', hash)
      .update(gameSeed)
      .digest('hex');

    const resultMaximum = 2 ** 52;
    const resultNumber = Number.parseInt(hashHmac.slice(0, 13), 16);
    const resultRandom =
      resultNumber % 33 === 0
        ? 100
        : (100 * resultMaximum - resultNumber) / (resultMaximum - resultNumber);
    const crashValue = Math.floor(resultRandom) / 100;
    console.log('Game:', {
      serverSeed,
      serverSeedHash,
      gameSeed,
      hash,
      hashHmac,
      crashValue,
    });
    await this.aviatorRoundRepository.setCrashValue(crashValue);
    return {
      serverSeed,
      serverSeedHash,
      playerSeed1,
      playerSeed2,
      playerSeed3,
      crashValue,
    };
  }

  getMultiplier(roundStatus: RoundStatus, roundStartTime: Date): number {
    if (roundStatus === RoundStatus.ended) {
      throw new BadRequestException('Round not started');
    }
    const timeDiff = dayjs().diff(dayjs(roundStartTime), 'milliseconds');
    const multiplier =
      1 + Number(Big(timeDiff).mul(timeDiff).div(MAX_MULTIPLIER).toFixed(2));
    return multiplier;
  }

  async generatePlayerSeed(playerKey: string, userId: string) {
    const { roundNo } = await this.aviatorRoundRepository.getCurrentRoundInfo();
    const playerSeed = `${userId}${roundNo}${crypto
      .randomBytes(16)
      .toString('hex')}`;
    await this.aviatorRoundRepository.setPlayerSeed(playerKey, playerSeed);
  }

  async updateUserHistory(
    userId: string,
    roundNo: number,
    cashoutAmount: number,
    betAmount: number,
  ) {
    await this.aviatorHistoryRepository.updateUserHistory(
      userId,
      roundNo,
      cashoutAmount,
      betAmount,
    );
  }

  async getCurrentRoundPlayers() {
    const { roundNo } = await this.aviatorRoundRepository.getCurrentRoundInfo();
    return await this.aviatorHistoryRepository.getCurrentRoundPlayers(roundNo);
  }

  async updateRoundHistory(
    roundNo: number,
    crashValue: number,
    serverSeed: string,
  ) {
    await this.aviatorHistoryRepository.updateRoundHistory(
      roundNo,
      crashValue,
      serverSeed,
    );
  }

  private async debitBetAmount(
    roundNo: number,
    userId: UserID,
    amount: string,
  ) {
    await this.walletServiceGateway.debitAviatorBetAmount(
      roundNo,
      userId,
      amount,
    );
  }

  async addWinningAmount(userId: string, amount: string) {
    const { roundNo } = await this.aviatorRoundRepository.getCurrentRoundInfo();
    await this.walletServiceGateway.creditAviatorWinningAmount(
      roundNo,
      userId,
      amount,
    );
  }

  async checkIfReconnected(userId: string): Promise<boolean> {
    const { roundNo, roundStatus } =
      await this.aviatorRoundRepository.getCurrentRoundInfo();
    const userBetAmount = await this.aviatorRoundRepository.getBetInfo(
      roundNo,
      userId,
    );
    return roundStatus !== RoundStatus.ended && !!userBetAmount;
  }
}
