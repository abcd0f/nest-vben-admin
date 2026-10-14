import { asBoolean, asInteger, asObject, asOptionalString, asString, defineConfigDomain } from '../core/index.js';

export interface RedisConfig {
  enabled: boolean;
  url: string;
  keyPrefix: string;
  connectTimeout: number;
  commandTimeout: number;
  maxRetriesPerRequest: number;
  password?: string;
}

const DEFAULT_KEY_PREFIX = 'cache';
const DEFAULT_CONNECT_TIMEOUT = 5_000;
const DEFAULT_COMMAND_TIMEOUT = 5_000;
const DEFAULT_MAX_RETRIES_PER_REQUEST = 3;

export const redisDomain = defineConfigDomain<RedisConfig>({
  namespace: 'redis',
  parse(raw): RedisConfig {
    const value = asObject(raw, 'redis');
    const enabled = asBoolean(value.enabled, 'redis.enabled', false);
    const url = asOptionalString(value.url, 'redis.url');

    if (enabled && !url) {
      throw new Error('redis.enabled 为 true 时必须配置 redis.url（例：redis://127.0.0.1:6379/0）');
    }

    return {
      enabled,
      url: url ?? '',
      keyPrefix: asString(value['key-prefix'], 'redis.key-prefix', DEFAULT_KEY_PREFIX),
      connectTimeout: asInteger(value['connect-timeout'], 'redis.connect-timeout', DEFAULT_CONNECT_TIMEOUT, 0),
      commandTimeout: asInteger(value['command-timeout'], 'redis.command-timeout', DEFAULT_COMMAND_TIMEOUT, 0),
      maxRetriesPerRequest: asInteger(
        value['max-retries-per-request'],
        'redis.max-retries-per-request',
        DEFAULT_MAX_RETRIES_PER_REQUEST,
        0,
      ),
      password: asOptionalString(value.password, 'redis.password'),
    };
  },
});

export const redisConfig = redisDomain.token;
