import type { AppEnv } from './app.config.js';
import type { CorsEnv } from './cors.config.js';
import type { DatabaseEnv } from './database.config.js';
import type { EnvSource } from './env.utils.js';
import type { LoggerEnv } from './logger.config.js';
import type { RedisEnv } from './redis.config.js';
import type { SwaggerEnv } from './swagger.config.js';
import { parseAppEnv } from './app.config.js';
import { parseCorsEnv } from './cors.config.js';
import { parseDatabaseEnv } from './database.config.js';
import { parseLoggerEnv } from './logger.config.js';
import { parseRedisEnv } from './redis.config.js';
import { parseSwaggerEnv } from './swagger.config.js';

export type Env = AppEnv & CorsEnv & DatabaseEnv & LoggerEnv & RedisEnv & SwaggerEnv;

const parsers: Array<(raw: EnvSource) => object> = [
  parseAppEnv,
  parseCorsEnv,
  parseDatabaseEnv,
  parseLoggerEnv,
  parseRedisEnv,
  parseSwaggerEnv,
];

export function validateEnv(raw: EnvSource): Env {
  const parsed: object[] = [];
  const errors: string[] = [];

  for (const parse of parsers) {
    try {
      parsed.push(parse(raw));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(...message.split('\n'));
    }
  }

  if (errors.length > 0) {
    throw new Error(`环境变量校验失败：\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  }

  return Object.assign({}, ...parsed) as Env;
}
