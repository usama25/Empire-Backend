export type RedisKey = string;

export type RedisValue = string | number | object | null;

export type RedisConnectionOptions = {
  host: string;
  port: number;
  isClustered: boolean;
  isTlsEnabled: boolean;
};
