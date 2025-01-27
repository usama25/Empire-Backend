import Redis, { Cluster, RedisOptions } from 'ioredis';
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';

import { delay } from '@lib/fabzen-common/utils/time.utils';

import { RedisValue } from '../types';
import { config } from '@lib/fabzen-common/configuration';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  client!: Redis | Cluster;

  constructor() {
    const { host, port, tlsEnabled } = config.reGameplay.redis;
    const option: RedisOptions = {
      host,
      port,
    };
    if (tlsEnabled) {
      option.tls = {};
    }
    this.client = new Redis(option);
  }

  async getValue<T>(
    key: string,
    field?: string,
    needJsonParse?: boolean,
  ): Promise<T | undefined> {
    const rawValue = field
      ? await this.client.hget(key, field)
      : await this.client.get(key);
    if (rawValue === null) {
      return undefined;
    }
    if (needJsonParse) {
      try {
        return JSON.parse(rawValue) as T;
      } catch (error) {
        this.logger.error(`Error parsing redis value: ${rawValue}`);
        throw error;
      }
    }
    return rawValue as T;
  }

  async getMultipleValues(key: string, fields: string[]): Promise<string[]> {
    const values = await this.client.hmget(key, ...fields);
    return values.filter(Boolean) as string[];
  }

  async setValue(
    key: string,
    field: string,
    value: RedisValue,
    expireAfterSeconds?: number,
  ) {
    try {
      if (value === null || value === undefined) {
        throw new InternalServerErrorException('Cannot set null value');
      }
      const rawValue =
        typeof value === 'object' ? JSON.stringify(value) : value;
      if (field === '') {
        await (expireAfterSeconds && expireAfterSeconds > 0
          ? this.client.setex(key, expireAfterSeconds, rawValue)
          : this.client.set(key, rawValue));
      } else {
        await this.client.hset(key, field, rawValue);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async deleteKey(key: string, field?: string) {
    field ? await this.client.hdel(key, field) : await this.client.del(key);
  }

  async keyExists(key: string, field?: string): Promise<boolean> {
    return field
      ? (await this.client.hexists(key, field)) > 0
      : (await this.client.exists(key)) > 0;
  }

  async getKeys(key: string): Promise<string[]> {
    return this.client.hkeys(key);
  }

  async getVals(key: string): Promise<string[]> {
    return this.client.hvals(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async aquireLock(key: string, pid: string): Promise<boolean> {
    const retryLimit = 10;
    let retryCount = 0;

    while (retryCount < retryLimit) {
      try {
        const result = await this.client.set(
          `${config.redis.keyPrefixes.lockKey}:${key}`,
          pid,
          'NX',
        );

        console.log('TABLE LOCK RESULT', result);

        if (result !== 'OK') {
          throw new Error('Transaction Failed');
        }
        return true;
      } catch {
        retryCount++;
        await delay(100);
      }
    }
    throw new ServiceUnavailableException(
      'Still Processing the previous request',
    );
  }

  async releaseLock(key: string, pid?: string): Promise<void> {
    if (pid) {
      const result = await this.client.get(
        `${config.redis.keyPrefixes.lockKey}:${key}`,
      );
      if (result !== pid) {
        return;
      }
    }
    await this.client.del(`${config.redis.keyPrefixes.lockKey}:${key}`);
  }

  async increment(key: string, field: string, value: number) {
    await this.client.hincrby(key, field, value);
  }

  async flushAll() {
    await this.client.flushall();
  }
}
