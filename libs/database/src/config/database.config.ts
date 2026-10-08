import type { ConfigService } from '@nestjs/config';

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
  /** PostgreSQL schema，运行时通过驱动适配器传入（见下） */
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

/**
 * 从 ConfigService 解析出强类型的数据库配置。
 *
 * 集中到一处，避免 `configService.get('DATABASE_XXX')` 这种字符串散落各处——
 * 那样改一个变量名要全局搜，且拼错了不会有编译错误。
 */
export function resolveDatabaseConfig(config: ConfigService): DatabaseConfig {
  const url = config.getOrThrow<string>('DATABASE_URL');

  return {
    url,
    schema: resolveSchema(url),
    pool: {
      max: config.get<number>('DATABASE_POOL_MAX', 10),
      idleTimeoutMillis: config.get<number>('DATABASE_POOL_IDLE_TIMEOUT', 10_000),
      connectionTimeoutMillis: config.get<number>('DATABASE_CONNECT_TIMEOUT', 5_000),
    },
    logQueries: config.get<boolean>('DATABASE_LOG_QUERIES', false),
  };
}
