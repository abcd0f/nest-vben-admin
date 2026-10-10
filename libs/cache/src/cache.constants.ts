/** DI 令牌：ioredis 客户端实例；未启用 Redis 时为 `null` */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** 分布式锁默认持有时长（秒） */
export const DEFAULT_LOCK_TTL_SECONDS = 30;

/** `SCAN` 每批返回的键数量提示（COUNT）。只是提示，不是硬性上限 */
export const SCAN_BATCH_SIZE = 200;

/**
 * 释放锁的原子脚本。
 *
 * 只有「当前值等于持有者令牌」时才删除，避免业务超时导致锁已易主后误删他人的锁。
 * 比较与删除必须放在 Redis 侧一次执行（Lua），否则中间存在竞态窗口。
 */
export const RELEASE_LOCK_SCRIPT = `if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0`;
