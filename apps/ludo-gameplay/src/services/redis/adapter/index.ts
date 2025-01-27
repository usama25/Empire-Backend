import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { config } from '@lib/fabzen-common/configuration';
import { Games } from '@lib/fabzen-common/types';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(): Promise<void> {
    const pubClient = this.createRedisClient();
    const subClient = pubClient.duplicate();

    try {
      this.adapterConstructor = createAdapter(pubClient, subClient, {
        key: Games.ludo,
      });
      this.logger.log('RedisIoAdapter initialized');
    } catch (error) {
      this.logger.error('Error connecting to redis: ', error);
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }

  private createRedisClient(): Redis {
    const { host, port } = config.redis.adapter;
    return new Redis({ host, port });
  }
}
