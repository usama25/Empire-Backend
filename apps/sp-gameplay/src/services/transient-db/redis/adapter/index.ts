import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { config } from '@lib/fabzen-common/configuration';
import { FbzLogger } from '@lib/fabzen-common/utils/logger.util';
import { Games } from '@lib/fabzen-common/types';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private readonly logger = new FbzLogger(RedisIoAdapter.name);

  async connectToRedis(): Promise<void> {
    const pubClient = config.redis.adapter.isClustered
      ? this.getClusterClient()
      : this.getWithoutClusterClient();

    const subClient = pubClient.duplicate();

    try {
      this.adapterConstructor = createAdapter(pubClient, subClient, {
        key: Games.skillpatti,
      });
    } catch (error) {
      this.logger.error('Error connecting to redis: ', error);
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }

  private getClusterClient() {
    return new Redis.Cluster([
      {
        host: config.redis.adapter.host,
        port: config.redis.adapter.port,
      },
    ]);
  }

  private getWithoutClusterClient() {
    return new Redis({
      host: config.redis.adapter.host,
      port: config.redis.adapter.port,
      lazyConnect: true,
    });
  }
}
