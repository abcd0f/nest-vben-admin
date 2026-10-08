import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { booleanEnv } from '../env/env.utils.js';

/** 数据库环境变量契约 */
export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 必填，例如 postgresql://user:pass@host:5432/db'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_POOL_IDLE_TIMEOUT: z.coerce.number().int().nonnegative().default(10_000),
  DATABASE_CONNECT_TIMEOUT: z.coerce.number().int().nonnegative().default(5_000),
  DATABASE_LOG_QUERIES: booleanEnv('false'),
});

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

/**
 * 从连接串里取 schema。
 *
 * 为什么要单独取：Prisma CLI 认 URL 上的 `?schema=`，但运行时的驱动适配器
 * （@prisma/adapter-pg）不认——schema 必须通过第二个参数传入。
 * 这里统一从 DATABASE_URL 解析，保证 CLI 与运行时用的是同一个 schema，避免两处配置漂移。
 */
function resolveSchema(url: string): string {
  try {
    return new URL(url).searchParams.get('schema') ?? DEFAULT_SCHEMA;
  } catch {
    return DEFAULT_SCHEMA;
  }
}

/** 数据库配置。工厂只读 process.env，理由见 app.config.ts 的注释。 */
export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  const env = databaseEnvSchema.parse(process.env);

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
});
