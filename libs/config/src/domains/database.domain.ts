import { defineConfigDomain } from '../core/index.js';

const DEFAULT_SCHEMA = 'public';

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

/** `?schema=` 只有 Prisma CLI 认，运行时由驱动适配器接收 */
function resolveSchema(url: string): string {
  try {
    return new URL(url).searchParams.get('schema') ?? DEFAULT_SCHEMA;
  } catch {
    return DEFAULT_SCHEMA;
  }
}

export const databaseDomain = defineConfigDomain({
  namespace: 'database',
  fields: {
    url: { type: 'string', minLength: 1 },
    poolMax: { type: 'integer', default: 10, min: 1 },
    poolIdleTimeout: { type: 'integer', default: 10_000, min: 0 },
    connectTimeout: { type: 'integer', default: 5_000, min: 0 },
    logQueries: { type: 'boolean', default: false },
  },
  resolve: (values): DatabaseConfig => ({
    url: values.url,
    schema: resolveSchema(values.url),
    pool: {
      max: values.poolMax,
      idleTimeoutMillis: values.poolIdleTimeout,
      connectionTimeoutMillis: values.connectTimeout,
    },
    logQueries: values.logQueries,
  }),
});

export const databaseConfig = databaseDomain.token;
