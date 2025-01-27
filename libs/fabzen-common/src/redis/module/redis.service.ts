import Redis, { Cluster, RedisOptions } from 'ioredis';
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';

import { delay } from '@lib/fabzen-common/utils/time.utils';

import { RedisConnectionOptions, RedisValue } from '../types';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  client!: Redis | Cluster;

  constructor(option: RedisConnectionOptions) {
    this.client = option.isClustered
      ? this.#connectToCluster(option)
      : this.#connectWithoutCluster(option);
  }

  #connectToCluster({ host }: RedisConnectionOptions): Cluster {
    const clusterNodesArray = host.split(',').map((url) => {
      const [host, port] = url.split(':');
      return {
        host,
        port: Number(port),
      };
    });
    return new Redis.Cluster(clusterNodesArray, {
      slotsRefreshTimeout: 10_000,
      scaleReads: 'slave',
    });
  }

  #connectWithoutCluster({
    host,
    port,
    isTlsEnabled,
  }: RedisConnectionOptions): Redis {
    const option: RedisOptions = {
      host,
      port,
    };
    if (isTlsEnabled) {
      option.tls = {};
    }
    return new Redis(option);
  }

  getClient(): Redis | Cluster {
    return this.client;
  }

  async flushRedis(): Promise<void> {
    await this.client.flushall();
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

  async getAllHashkeyValues<T>(
    key: string,
    needJsonParse?: boolean,
  ): Promise<Record<string, T>> {
    const allKeyValuesRaw = await this.client.hgetall(key);
    const allKeyValues: Record<string, T> = {};
    for (const key in allKeyValuesRaw) {
      const value = allKeyValuesRaw[key];
      let parsedValue: T;
      if (needJsonParse) {
        try {
          parsedValue = JSON.parse(value) as T;
        } catch {
          this.logger.error(`Error parsing redis value: ${value}`);
          parsedValue = value as T;
        }
      } else {
        parsedValue = value as T;
      }
      allKeyValues[key] = parsedValue;
    }
    return allKeyValues;
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

  async setMultipleHashkeyValues(
    key: string,
    keyValues: Record<string, any>,
    needStringify?: boolean,
  ) {
    if (needStringify) {
      for (const key in keyValues) {
        const value = keyValues[key];
        keyValues[key] = JSON.stringify(value);
      }
    }
    await this.client.hmset(key, keyValues);
  }

  async deleteKey(key: string, field?: string) {
    field ? await this.client.hdel(key, field) : await this.client.del(key);
  }

  async deleteMultipleHashkeys(key: string, fields: string[]) {
    await this.client.hdel(key, ...fields);
  }

  async keyExists(key: string, field?: string): Promise<boolean> {
    return field
      ? (await this.client.hexists(key, field)) > 0
      : (await this.client.exists(key)) > 0;
  }

  async getKeys(key: string): Promise<string[]> {
    return this.client.hkeys(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  // TODO: This needs to be removed, Use Locker Service instead
  async aquireLock(key: string): Promise<boolean> {
    const retryLimit = 10;
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

  // TODO: This needs to be removed, Use Locker Service instead
  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }
}
