import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis, { Cluster, RedisOptions } from 'ioredis';

import { config } from '@lib/fabzen-common/configuration';
import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';

import { RedisValue } from '../types';
import { delay } from '@lib/fabzen-common/utils/time.utils';

@Injectable()
export class RedisService {
  private readonly logger = new FbzLogger(RedisService.name);
  client!: Redis | Cluster;

  constructor() {
    if (config.cbrGameplay.redis.isClustered) {
      this.connectToCluster();
    } else {
      this.connectWithoutCluster();
    }
  }

  private connectToCluster() {
    this.client = new Redis.Cluster([
      {
        host: config.cbrGameplay.redis.host,
        port: config.cbrGameplay.redis.port,
      },
    ]);
  }
  private connectWithoutCluster() {
    const { host, port, tlsEnabled } = config.cbrGameplay.redis;
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
    this.client;
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
        throw error;
      }
    }
    await delay(5);
    return rawValue as T;
  }

  async setValue(
    key: string,
    field: string,
    value: RedisValue,
    expireAfterSeconds?: number,
  ) {
    if (value === null || value === undefined) {
      throw new InternalServerErrorException('Cannot set null value');
    }
    const rawValue = typeof value === 'object' ? JSON.stringify(value) : value;
    if (field === '') {
      await (expireAfterSeconds && expireAfterSeconds > 0
        ? this.client.setex(key, expireAfterSeconds, rawValue)
        : this.client.set(key, rawValue));
    } else {
      await this.client.hset(key, field, rawValue);
    }
  }

  async deleteKey(key: string, field?: string) {
    field ? await this.client.hdel(key, field) : await this.client.del(key);
  }

  async flushAll() {
    await this.client.flushall();
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

  async getTableKeys(): Promise<string[]> {
    const keys = await this.client.keys('*');
    const tablePrefix = config.cbrGameplay.redis.tablePrefix;
    return keys
      .filter((key: any) => key.startsWith(tablePrefix))
      .map((key: any) => key.slice(tablePrefix.length));
  }

  async aquireLock(key: string): Promise<boolean> {
    const retryLimit = 50;
    let retryCount = 0;

    while (retryCount < retryLimit) {
      try {
        const result = await this.client.set(key, 1, 'NX');
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

  async aquireLongLock(key: string): Promise<boolean> {
    const retryLimit = 100;
    let retryCount = 0;

    while (retryCount < retryLimit) {
      try {
        const result = await this.client.set(key, 1, 'NX');
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

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }
}
