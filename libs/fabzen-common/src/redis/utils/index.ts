import Redis, { Cluster, RedisOptions } from 'ioredis';

import { config } from '@lib/fabzen-common/configuration/configuration';

const { host, port, isTlsEnabled } = config.ludoGameplay.redis;

export function connectToCluster(): Cluster {
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

export function connectWithoutCluster(): Redis {
  const option: RedisOptions = {
    host,
    port,
  };
  if (isTlsEnabled) {
    option.tls = {};
  }
  return new Redis(option);
}
