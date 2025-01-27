import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { RedisService } from '../redis/module';
import { delay } from '../utils/time.utils';
import { getRandomInteger } from '../utils/random.utils';

@Injectable()
export class LockerService {
  constructor(private readonly redisService: RedisService) {}

  async acquireLock(lockKey: string, ttl: number = 12_000): Promise<boolean> {
    const client = this.redisService.getClient();

    const retryLimit = 500;
    let retryCount = 0;
    while (retryCount < retryLimit) {
      try {
        const result = await client.set(lockKey, 'locked', 'PX', ttl, 'NX');
        if (result !== 'OK') {
          throw new Error('Transaction Failed');
        }
        return true;
      } catch {
        retryCount++;
        await delay(getRandomInteger(100, 500));
      }
    }
    throw new ServiceUnavailableException(
      `Still Processing the previous request. Key: ${lockKey}`,
    );
  }

  async releaseLock(lockKey: string): Promise<void> {
    const client = this.redisService.getClient();
    await client.del(lockKey);
  }
}
