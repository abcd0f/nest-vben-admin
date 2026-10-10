import type { RedisConfig } from '@app/config';
import { redisConfig } from '@app/config';
import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT } from './cache.constants.js';
import { CacheService } from './cache.service.js';
import { RedisService } from './redis.service.js';

const disabledConfig: RedisConfig = {
  enabled: false,
  url: '',
  keyPrefix: 'test',
  connectTimeout: 1_000,
  commandTimeout: 1_000,
  maxRetriesPerRequest: 3,
};

/**
 * 未启用 Redis 时的行为。
 *
 * 这里刻意不 mock ioredis：`REDIS_CLIENT` 直接注入 `null`，
 * 验证「未启用」是一条显式失败路径，而不是静默降级成「永远 miss」。
 * 真正的读写行为依赖真实 Redis，属于集成测试范畴。
 */
describe('cacheService（未启用 Redis）', () => {
  let service: CacheService;
  let redis: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: REDIS_CLIENT, useValue: null },
        { provide: redisConfig.KEY, useValue: disabledConfig },
        RedisService,
        CacheService,
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    redis = module.get<RedisService>(RedisService);
  });

  it('实例可被解析，且标记为未启用', () => {
    expect(service).toBeDefined();
    expect(redis.enabled).toBe(false);
  });

  it('读取抛出明确的未启用错误，而不是返回 null', async () => {
    await expect(service.get('user:1')).rejects.toThrow(/Redis 未启用/);
  });

  it('写入同样抛出未启用错误', async () => {
    await expect(service.set('user:1', { name: 'a' })).rejects.toThrow(/Redis 未启用/);
  });

  it('取原始客户端会抛错，避免拿到 undefined 后静默失败', () => {
    expect(() => redis.client).toThrow(/Redis 未启用/);
  });

  it('健康检查返回 disabled 而不是 down', async () => {
    await expect(redis.health()).resolves.toEqual({ status: 'disabled', latencyMs: 0 });
  });
});
