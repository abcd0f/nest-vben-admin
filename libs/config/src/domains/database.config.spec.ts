import { withEnv } from '../env/env.testing.js';
import { databaseConfig } from './database.config.js';

const ALL_DATABASE_ENV = {
  DATABASE_URL: undefined,
  DATABASE_POOL_MAX: undefined,
  DATABASE_POOL_IDLE_TIMEOUT: undefined,
  DATABASE_CONNECT_TIMEOUT: undefined,
  DATABASE_LOG_QUERIES: undefined,
} as const;

describe('databaseConfig', () => {
  it('解析连接串，其余取默认值', () => {
    withEnv(
      { ...ALL_DATABASE_ENV, DATABASE_URL: 'postgresql://root:123456@localhost:5432/nest-admin?schema=public' },
      () => {
        expect(databaseConfig()).toEqual({
          url: 'postgresql://root:123456@localhost:5432/nest-admin?schema=public',
          schema: 'public',
          pool: { max: 10, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 },
          logQueries: false,
        });
      },
    );
  });

  it('从连接串的 ?schema= 解析 schema —— 保证 Prisma CLI 与运行时同源', () => {
    withEnv({ ...ALL_DATABASE_ENV, DATABASE_URL: 'postgresql://u:p@h:5432/db?schema=business' }, () => {
      expect(databaseConfig().schema).toBe('business');
    });
  });

  it('连接串没有 ?schema= 时回落到 public', () => {
    withEnv({ ...ALL_DATABASE_ENV, DATABASE_URL: 'postgresql://u:p@h:5432/db' }, () => {
      expect(databaseConfig().schema).toBe('public');
    });
  });

  it('连接串非法时也不抛错，schema 回落 public', () => {
    withEnv({ ...ALL_DATABASE_ENV, DATABASE_URL: 'not-a-url' }, () => {
      expect(databaseConfig().schema).toBe('public');
    });
  });

  it('连接池参数被环境变量覆盖并转成数字', () => {
    withEnv(
      {
        ...ALL_DATABASE_ENV,
        DATABASE_URL: 'postgresql://u:p@h:5432/db',
        DATABASE_POOL_MAX: '20',
        DATABASE_POOL_IDLE_TIMEOUT: '30000',
        DATABASE_CONNECT_TIMEOUT: '2000',
        DATABASE_LOG_QUERIES: 'true',
      },
      () => {
        const config = databaseConfig();

        expect(config.pool).toEqual({ max: 20, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 2_000 });
        expect(config.logQueries).toBe(true);
      },
    );
  });
});
