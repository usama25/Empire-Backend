import { Injectable, Logger } from '@nestjs/common';

import { EPLMatchingQueueService } from '../../domain/interfaces/queue.service';
import { RedisService } from '@lib/fabzen-common/redis/module';
import { USER_WAITING_KEY, BIG_TABLE_USER_KEY } from './constants';
import { WaitingInfo } from '../../domain/use-cases/types';

@Injectable()
export class EPLRedisMatchingQueueService implements EPLMatchingQueueService {
  private readonly logger = new Logger(EPLRedisMatchingQueueService.name);

  constructor(private readonly redisService: RedisService) {}

  async putInQueue(tableTypeId: string, newUser: WaitingInfo) {
    const queueName = this.getQueueName(tableTypeId);
    await this.redisService.setValue(
      queueName,
      newUser.userDetails.userId,
      newUser,
    );
  }

  async setUserWaitingKey(userId: string, tableTypeId: string) {
    await this.redisService.setValue(USER_WAITING_KEY, userId, tableTypeId);
  }

  async getUserWaitingTableTypeId(userId: string): Promise<string | undefined> {
    return await this.redisService.getValue<string>(USER_WAITING_KEY, userId);
  }

  private getQueueName(tableTypeId: string): string {
    return `{EPLQueue}-${tableTypeId}`;
  }

  async getUsersFromQueue(tableTypeId: string): Promise<WaitingInfo[]> {
    const allWaitingUsers =
      await this.redisService.getAllHashkeyValues<WaitingInfo>(
        this.getQueueName(tableTypeId),
        true,
      );
    return Object.values(allWaitingUsers).sort((a, b) => a.expiry - b.expiry);
  }

  async removeUsersFromQueue(
    tableTypeId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length > 0) {
      const queueName = this.getQueueName(tableTypeId);
      await this.redisService.deleteMultipleHashkeys(queueName, userIds);
      await this.redisService.deleteMultipleHashkeys(USER_WAITING_KEY, userIds);
    }
  }

  async getBigTableUsers(): Promise<string[]> {
    const bigTableUsers =
      await this.redisService.getAllHashkeyValues<boolean>(BIG_TABLE_USER_KEY);
    return Object.keys(bigTableUsers);
  }

  async setBigTableUsers(userIds: string[]): Promise<void> {
    const keyValues: Record<string, boolean> = {};
    for (const userId of userIds) {
      keyValues[userId] = true;
    }
    await this.redisService.setMultipleHashkeyValues(
      BIG_TABLE_USER_KEY,
      keyValues,
    );
  }

  async deleteBigTableUsers(userIds: string[]): Promise<void> {
    await this.redisService.deleteMultipleHashkeys(BIG_TABLE_USER_KEY, userIds);
  }
}
