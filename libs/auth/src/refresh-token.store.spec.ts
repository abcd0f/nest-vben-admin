import type { RedisService } from '@app/cache';
import type { RedisConfig } from '@app/config';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { RefreshTokenStore } from './refresh-token.store.js';

const testUrl = process.env.REDIS_TEST_URL;

describe.skipIf(!testUrl)('refresh token store with Redis', () => {
  let redis: Redis;
  let store: RefreshTokenStore;
  const prefix = `test:auth:${randomUUID()}`;

  beforeAll(async () => {
    redis = new Redis(testUrl!);
    await redis.ping();
    store = new RefreshTokenStore({ client: redis } as RedisService, { keyPrefix: prefix } as RedisConfig);
  });

  afterAll(async () => {
    if (!redis) return;
    const keys = await redis.keys(`${prefix}:auth:refresh:*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  });

  it('creates a session once and atomically accepts only one concurrent rotation', async () => {
    const sessionId = randomUUID();
    await store.create(sessionId, 'initial', 60);
    await expect(store.create(sessionId, 'duplicate', 60)).rejects.toThrow('刷新令牌会话创建失败');

    const results = await Promise.all([
      store.rotate(sessionId, 'initial', 'first', 60),
      store.rotate(sessionId, 'initial', 'second', 60),
    ]);
    expect(results).toContain(true);
    expect(results).toContain(false);
    expect(await store.rotate(sessionId, 'initial', 'replay', 60)).toBe(false);
  });
});
