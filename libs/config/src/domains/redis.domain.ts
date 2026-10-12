import { defineConfigDomain } from '../core/index.js';

export interface RedisConfig {
  enabled: boolean;
  /** 未启用时为空串 */
  url: string;
  keyPrefix: string;
  connectTimeout: number;
  commandTimeout: number;
  maxRetriesPerRequest: number;
  /** 独立密码（可选）。连接串里已含密码时无需重复设置 */
  password?: string;
}

const DEFAULT_KEY_PREFIX = 'cache';
const DEFAULT_CONNECT_TIMEOUT = 5_000;
const DEFAULT_COMMAND_TIMEOUT = 5_000;
const DEFAULT_MAX_RETRIES_PER_REQUEST = 3;

export const redisDomain = defineConfigDomain({
  namespace: 'redis',
  fields: {
    // 默认关闭：缓存属于可选基础设施，未显式开启时不建立任何连接，
    // 也不要求 url，避免「加了代码但没配 Redis」直接把应用启动搞挂。
    enabled: { type: 'boolean', default: false },
    url: { type: 'string', optional: true, trim: true },
    keyPrefix: { type: 'string', default: DEFAULT_KEY_PREFIX, minLength: 1 },
    connectTimeout: { type: 'integer', default: DEFAULT_CONNECT_TIMEOUT, min: 0 },
    commandTimeout: { type: 'integer', default: DEFAULT_COMMAND_TIMEOUT, min: 0 },
    maxRetriesPerRequest: { type: 'integer', default: DEFAULT_MAX_RETRIES_PER_REQUEST, min: 0 },
    password: { type: 'string', optional: true },
  },
  resolve: (values): RedisConfig => {
    // 关闭时允许缺 url；一旦启用就必须显式给出，避免生产环境悄悄连到本机 Redis。
    if (values.enabled && (values.url === undefined || values.url.length === 0)) {
      throw new Error('redis.enabled 为 true 时必须配置 redis.url（例：redis://127.0.0.1:6379/0）');
    }

    return {
      enabled: values.enabled,
      url: values.url ?? '',
      keyPrefix: values.keyPrefix,
      connectTimeout: values.connectTimeout,
      commandTimeout: values.commandTimeout,
      maxRetriesPerRequest: values.maxRetriesPerRequest,
      password: values.password,
    };
  },
});

export const redisConfig = redisDomain.token;
