import type { EnvSource } from './env.utils.js';
import { registerAs } from '@nestjs/config';
import {
  booleanValue,
  collectEnvValue,
  integerValue,
  optionalString,
  stringValue,
  throwEnvErrors,
} from './env.utils.js';

/** Redis 域原始环境变量 */
export interface RedisEnv {
  /** 是否启用 Redis 集成。不声明 = 关闭 */
  REDIS_ENABLED: boolean;
  /** 连接串。启用时必填，如 `redis://127.0.0.1:6379/0` */
  REDIS_URL?: string;
  /** 键前缀，用于命名空间隔离 */
  REDIS_KEY_PREFIX: string;
  /** 建立连接超时（毫秒） */
  REDIS_CONNECT_TIMEOUT: number;
  /** 单条命令超时（毫秒），0 = 不限制 */
  REDIS_COMMAND_TIMEOUT: number;
  /** 断线后单条命令的最大重试次数，超过即快速失败 */
  REDIS_MAX_RETRIES_PER_REQUEST: number;
  /** 独立密码（可选）。连接串里已含密码时无需重复设置 */
  REDIS_PASSWORD?: string;
}

/** Redis 域解析后的配置 */
export interface RedisConfig {
  enabled: boolean;
  /** 未启用时为空串 */
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

export function parseRedisEnv(raw: EnvSource): RedisEnv {
  const errors: string[] = [];
  const env = {
    // 默认关闭：缓存属于可选基础设施，未显式开启时不建立任何连接，
    // 也不要求 REDIS_URL，避免「加了代码但没配 Redis」直接把应用启动搞挂。
    REDIS_ENABLED: collectEnvValue(errors, false, () => booleanValue(raw, 'REDIS_ENABLED', false)),
    REDIS_URL: collectEnvValue<string | undefined>(errors, undefined, () => optionalString(raw, 'REDIS_URL', true)),
    REDIS_KEY_PREFIX: collectEnvValue(errors, DEFAULT_KEY_PREFIX, () => {
      return stringValue(raw, 'REDIS_KEY_PREFIX', DEFAULT_KEY_PREFIX, 1);
    }),
    REDIS_CONNECT_TIMEOUT: collectEnvValue(errors, DEFAULT_CONNECT_TIMEOUT, () => {
      return integerValue(raw, 'REDIS_CONNECT_TIMEOUT', DEFAULT_CONNECT_TIMEOUT, 0);
    }),
    REDIS_COMMAND_TIMEOUT: collectEnvValue(errors, DEFAULT_COMMAND_TIMEOUT, () => {
      return integerValue(raw, 'REDIS_COMMAND_TIMEOUT', DEFAULT_COMMAND_TIMEOUT, 0);
    }),
    REDIS_MAX_RETRIES_PER_REQUEST: collectEnvValue(errors, DEFAULT_MAX_RETRIES_PER_REQUEST, () => {
      return integerValue(raw, 'REDIS_MAX_RETRIES_PER_REQUEST', DEFAULT_MAX_RETRIES_PER_REQUEST, 0);
    }),
    REDIS_PASSWORD: collectEnvValue<string | undefined>(errors, undefined, () => optionalString(raw, 'REDIS_PASSWORD')),
  };

  throwEnvErrors(errors);
  return env;
}

export function createRedisConfig(env: RedisEnv): RedisConfig {
  // 关闭时允许缺 URL；一旦启用就必须显式给出，避免生产环境悄悄连到本机 Redis。
  if (env.REDIS_ENABLED && (env.REDIS_URL === undefined || env.REDIS_URL.length === 0)) {
    throw new Error('REDIS_ENABLED=true 时必须提供 REDIS_URL（例：redis://127.0.0.1:6379/0）');
  }

  return {
    enabled: env.REDIS_ENABLED,
    url: env.REDIS_URL ?? '',
    keyPrefix: env.REDIS_KEY_PREFIX,
    connectTimeout: env.REDIS_CONNECT_TIMEOUT,
    commandTimeout: env.REDIS_COMMAND_TIMEOUT,
    maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
    password: env.REDIS_PASSWORD,
  };
}

export const redisConfig = registerAs('redis', (): RedisConfig => createRedisConfig(parseRedisEnv(process.env)));
