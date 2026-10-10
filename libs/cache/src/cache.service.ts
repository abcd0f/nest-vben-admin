import type { RedisConfig } from '@app/config';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { redisConfig } from '@app/config';
import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_LOCK_TTL_SECONDS, RELEASE_LOCK_SCRIPT, SCAN_BATCH_SIZE } from './cache.constants.js';
import { buildCacheKey, decodeValue, encodeValue } from './cache.serializer.js';
import { RedisService } from './redis.service.js';

/** 写入选项 */
export interface CacheSetOptions {
  /** 过期时间（秒）。不传 = 永不过期 */
  ttl?: number;
}

/** 获取分布式锁的选项 */
export interface CacheLockOptions {
  /** 锁的持有时长（秒），到期自动释放。默认 30 */
  ttl?: number;
}

/** 已持有的分布式锁句柄 */
export interface CacheLock {
  /** 完整 Redis 键（已带命名空间前缀） */
  key: string;
  /** 持有者令牌，释放时用于校验，避免误删他人的锁 */
  token: string;
  /** 预计到期时间（毫秒时间戳） */
  expiresAt: number;
}

/**
 * 缓存门面（Facade）。
 *
 * 职责边界：
 * - 只放「跨业务复用」的通用能力：带命名空间的 KV、批量读写、cache-aside、计数器、分布式锁。
 * - 需要原生命令（Hash / List / Set / Pub-Sub / 自定义 Lua）时注入 `RedisService`，用它的 `client`。
 *
 * 分层：业务 Service → CacheService（缓存语义）→ RedisService（连接与生命周期）→ ioredis。
 *
 * 约定：
 * - 所有键自动加 `REDIS_KEY_PREFIX` 前缀，与其他应用共用实例时互不干扰；
 * - 值统一 JSON 编码，读接口返回 `T | null`，`null` 表示 miss（详见 cache.serializer.ts）。
 */
@Injectable()
export class CacheService {
  private readonly prefix: string;

  constructor(
    private readonly redis: RedisService,
    @Inject(redisConfig.KEY) config: RedisConfig,
  ) {
    this.prefix = config.keyPrefix;
  }

  // ---------- 基础读写 ----------

  /** 读取。键不存在返回 `null`。 */
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(this.buildKey(key));
    return decodeValue<T>(raw);
  }

  /** 写入。`ttl` 单位为秒，不传则永不过期。 */
  async set(key: string, value: unknown, options: CacheSetOptions = {}): Promise<void> {
    const payload = encodeValue(value);
    const fullKey = this.buildKey(key);

    if (options.ttl !== undefined) {
      await this.client.set(fullKey, payload, 'EX', options.ttl);
      return;
    }

    await this.client.set(fullKey, payload);
  }

  /** 删除一个或多个键，返回实际删除数量。 */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    return this.client.del(...keys.map((key) => this.buildKey(key)));
  }

  /** 键是否存在。 */
  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(this.buildKey(key));
    return count === 1;
  }

  /** 重设过期时间（秒）。键不存在返回 false。 */
  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.client.expire(this.buildKey(key), ttl);
    return result === 1;
  }

  /** 剩余存活时间（秒）。`-1` = 无过期时间，`-2` = 键不存在。 */
  ttl(key: string): Promise<number> {
    return this.client.ttl(this.buildKey(key));
  }

  // ---------- 批量 ----------

  /** 批量读取。顺序与入参一致，miss 位置为 `null`。 */
  async getMany<T>(keys: string[]): Promise<Array<T | null>> {
    if (keys.length === 0) {
      return [];
    }

    const values = await this.client.mget(...keys.map((key) => this.buildKey(key)));
    return values.map((raw: null | string) => decodeValue<T>(raw));
  }

  /**
   * 批量写入。`ttl` 对该批次内所有键生效。
   *
   * 这里用 `Promise.all` 而不是显式 pipeline：客户端开启了 `enableAutoPipelining`，
   * 同一 tick 内发出的命令会被 ioredis 自动合并成一次往返，效果等价而代码更简单。
   */
  async setMany(entries: Record<string, unknown>, options: CacheSetOptions = {}): Promise<void> {
    const keys = Object.keys(entries);

    if (keys.length === 0) {
      return;
    }

    await Promise.all(keys.map((key) => this.set(key, entries[key], options)));
  }

  // ---------- 计数器 ----------

  /**
   * 原子自增，返回自增后的值。首次调用按 `by` 初始化。
   *
   * 计数器以**原始整数**存储（不是 JSON 对象），与 `get<number>()` 兼容——
   * `JSON.parse('5')` 恰好还原为数字 5。
   */
  increment(key: string, by = 1): Promise<number> {
    return this.client.incrby(this.buildKey(key), by);
  }

  // ---------- cache-aside ----------

  /**
   * 读缓存，miss 时执行 `factory()` 并回写。
   *
   * 注意（缓存击穿）：并发 miss 时每个调用都会各自执行一次 `factory()`。
   * 对热点键请配合 `acquireLock()` 做单飞（single-flight），或改为后台预热。
   *
   * 注意：`factory()` 返回 `null` / `undefined` 时**不会**写入（与 miss 无法区分）；
   * 如需缓存「空结果」，请返回一个哨兵值（如 `{ empty: true }`）。
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, options: CacheSetOptions = {}): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();

    if (value !== null && value !== undefined) {
      await this.set(key, value, options);
    }

    return value;
  }

  // ---------- 按模式清理 ----------

  /**
   * 按 glob 模式删除键，返回删除数量。模式会自动带上命名空间前缀：
   * `delByPattern('user:*')` 实际匹配 `<prefix>:user:*`。
   *
   * 实现用 `SCAN` 游标分批扫描，**刻意不用 `KEYS`**——`KEYS` 会一次性遍历整个键空间
   * 并阻塞 Redis 单线程，在生产环境属于事故级命令。
   *
   * 即便如此仍要慎用：`SCAN` 的耗时与键总量相关，只适合低频的运维 / 失效操作。
   */
  async delByPattern(pattern: string): Promise<number> {
    const match = this.buildKey(pattern);
    let cursor = '0';
    let deleted = 0;

    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', match, 'COUNT', SCAN_BATCH_SIZE);

      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }

      cursor = next;
    } while (cursor !== '0');

    return deleted;
  }

  /** 清空本命名空间下的全部缓存（等价于 `delByPattern('*')`）。 */
  clear(): Promise<number> {
    return this.delByPattern('*');
  }

  // ---------- 分布式锁 ----------

  /**
   * 尝试获取分布式锁。拿到返回句柄；被占用返回 `null`（不阻塞、不排队）。
   *
   * 实现为 `SET key token NX PX ttl`：单条命令同时完成「不存在才写入」与「设置过期」，
   * 原子且不会像「先 SETNX 再 EXPIRE」那样在两步之间崩溃时留下永久死锁。
   *
   * ⚠️ 锁会自动过期，业务执行时间必须**显著小于** `ttl`，
   * 否则锁会在业务尚未完成时失效，出现两个持有者。
   */
  async acquireLock(name: string, options: CacheLockOptions = {}): Promise<CacheLock | null> {
    const ttlSeconds = options.ttl ?? DEFAULT_LOCK_TTL_SECONDS;
    const key = this.buildLockKey(name);
    const token = randomUUID();

    const result = await this.client.set(key, token, 'PX', ttlSeconds * 1000, 'NX');

    if (result !== 'OK') {
      return null;
    }

    return { key, token, expiresAt: Date.now() + ttlSeconds * 1000 };
  }

  /**
   * 释放锁。仅当锁仍由本次持有者持有时才删除（Lua 原子校验），
   * 因此即使业务超时导致锁已被他人获取，也不会误删别人的锁。
   */
  async releaseLock(lock: CacheLock): Promise<boolean> {
    const result = await this.client.eval(RELEASE_LOCK_SCRIPT, 1, lock.key, lock.token);
    return Number(result) === 1;
  }

  // ---------- 内部 ----------

  private get client(): Redis {
    return this.redis.client;
  }

  private buildKey(key: string): string {
    return buildCacheKey(this.prefix, key);
  }

  private buildLockKey(name: string): string {
    return `${this.prefix}:lock:${name}`;
  }
}
