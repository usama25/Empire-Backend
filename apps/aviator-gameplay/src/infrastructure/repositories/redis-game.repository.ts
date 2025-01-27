import { Injectable } from '@nestjs/common';

import { RedisService } from '@lib/fabzen-common/redis/module';

import { AviatorRoundRepository } from '../../domain/interfaces';
import {
  ROUND_INFO_KEY,
  ROUND_LOCK_KEY,
  ROUND_SEED_KEY,
  ROUND_PREFIX,
  ROUND_RESULT_KEY,
  SERVER_SEED,
} from './constants';
import { RoundInfo, RoundStatus } from '../../domain/use-cases';

@Injectable()
export class RedisAviatorGameTableRepository implements AviatorRoundRepository {
  constructor(private readonly redisService: RedisService) {}

  async getCurrentRoundInfo(): Promise<RoundInfo> {
    const roundInfo = await this.redisService.getValue<RoundInfo>(
      ROUND_INFO_KEY,
      ROUND_INFO_KEY,
      true,
    );
    if (!roundInfo) {
      const newRoundInfo = {
        roundNo: 0,
        roundStartTime: new Date(),
        roundStatus: RoundStatus.ended,
      };
      await this.redisService.setValue(
        ROUND_INFO_KEY,
        ROUND_INFO_KEY,
        newRoundInfo,
      );
      return newRoundInfo;
    }
    return roundInfo;
  }

  async setCurrentRoundInfo(roundInfo: RoundInfo): Promise<void> {
    await this.redisService.setValue(ROUND_INFO_KEY, ROUND_INFO_KEY, roundInfo);
  }

  async initializeRound(roundNo: number): Promise<void> {
    await this.redisService.deleteKey(ROUND_PREFIX + roundNo);
    await this.redisService.deleteKey(ROUND_INFO_KEY, ROUND_RESULT_KEY);
  }

  async playerBet(
    roundNo: number,
    userId: string,
    amount: string,
  ): Promise<void> {
    await this.redisService.setValue(ROUND_PREFIX + roundNo, userId, amount);
  }

  async getBetInfo(
    roundNo: number,
    userId: string,
  ): Promise<string | undefined> {
    const betAmount = await this.redisService.getValue<string>(
      ROUND_PREFIX + roundNo,
      userId,
    );
    return betAmount;
  }

  async getRoundlock(): Promise<boolean> {
    const lock = await this.redisService.getValue<boolean>(
      ROUND_LOCK_KEY,
      ROUND_LOCK_KEY,
    );
    return !!lock;
  }

  async getBetUsers(roundNo: number): Promise<string[]> {
    return await this.redisService.getKeys(ROUND_PREFIX + roundNo);
  }

  async setRoundlock(lock: boolean): Promise<void> {
    await (lock
      ? this.redisService.setValue(ROUND_LOCK_KEY, ROUND_LOCK_KEY, 1)
      : this.redisService.deleteKey(ROUND_LOCK_KEY));
  }

  async getPlayerSeed(playerKey: string): Promise<string | undefined> {
    return await this.redisService.getValue<string>(ROUND_SEED_KEY, playerKey);
  }

  async setPlayerSeed(playerKey: string, seed: string): Promise<void> {
    await this.redisService.setValue(ROUND_SEED_KEY, playerKey, seed);
  }

  async getCrashValue(): Promise<number | undefined> {
    return await this.redisService.getValue<number>(
      ROUND_INFO_KEY,
      ROUND_RESULT_KEY,
    );
  }

  async setCrashValue(value: number): Promise<void> {
    await this.redisService.setValue(ROUND_INFO_KEY, ROUND_RESULT_KEY, value);
  }

  async getServerSeed(): Promise<string | undefined> {
    return await this.redisService.getValue<string>(
      ROUND_SEED_KEY,
      SERVER_SEED,
    );
  }

  async setServerSeed(serverSeed: string): Promise<void> {
    await this.redisService.setValue(ROUND_SEED_KEY, SERVER_SEED, serverSeed);
  }
}
