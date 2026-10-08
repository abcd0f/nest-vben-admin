import type { EnvSource } from './env.utils.js';
import { registerAs } from '@nestjs/config';
import { booleanValue, collectEnvValue, integerValue, stringValue, throwEnvErrors } from './env.utils.js';

export interface DatabaseEnv {
  DATABASE_URL: string;
  DATABASE_POOL_MAX: number;
  DATABASE_POOL_IDLE_TIMEOUT: number;
  DATABASE_CONNECT_TIMEOUT: number;
  DATABASE_LOG_QUERIES: boolean;
}

export interface DatabasePoolConfig {
  /** 连接池最大连接数 */
  max: number;
  /** 空闲连接回收时间（毫秒） */
  idleTimeoutMillis: number;
  /** 建立连接超时时间（毫秒） */
  connectionTimeoutMillis: number;
}

export interface DatabaseConfig {
  url: string;
  /** PostgreSQL schema，运行时通过驱动适配器传入（见 PrismaService） */
  schema: string;
  pool: DatabasePoolConfig;
  logQueries: boolean;
}

const DEFAULT_SCHEMA = 'public';

export function parseDatabaseEnv(raw: EnvSource): DatabaseEnv {
  const errors: string[] = [];
  const env = {
    DATABASE_URL: collectEnvValue(errors, '', () => stringValue(raw, 'DATABASE_URL', undefined, 1)),
    DATABASE_POOL_MAX: collectEnvValue(errors, 10, () => integerValue(raw, 'DATABASE_POOL_MAX', 10, 1)),
    DATABASE_POOL_IDLE_TIMEOUT: collectEnvValue(errors, 10_000, () =>
      integerValue(raw, 'DATABASE_POOL_IDLE_TIMEOUT', 10_000, 0)),
    DATABASE_CONNECT_TIMEOUT: collectEnvValue(errors, 5_000, () =>
      integerValue(raw, 'DATABASE_CONNECT_TIMEOUT', 5_000, 0)),
    DATABASE_LOG_QUERIES: collectEnvValue(errors, false, () => booleanValue(raw, 'DATABASE_LOG_QUERIES', false)),
  };

  throwEnvErrors(errors);
  return env;
}

function resolveSchema(url: string): string {
  try {
    return new URL(url).searchParams.get('schema') ?? DEFAULT_SCHEMA;
  } catch {
    return DEFAULT_SCHEMA;
  }
}

export function createDatabaseConfig(env: DatabaseEnv): DatabaseConfig {
  return {
    url: env.DATABASE_URL,
    schema: resolveSchema(env.DATABASE_URL),
    pool: {
      max: env.DATABASE_POOL_MAX,
      idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT,
      connectionTimeoutMillis: env.DATABASE_CONNECT_TIMEOUT,
    },
    logQueries: env.DATABASE_LOG_QUERIES,
  };
}

export const databaseConfig = registerAs('database', (): DatabaseConfig =>
  createDatabaseConfig(parseDatabaseEnv(process.env)));
