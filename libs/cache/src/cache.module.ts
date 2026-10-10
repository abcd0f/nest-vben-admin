import type { RedisConfig } from '@app/config';
import type { DynamicModule } from '@nestjs/common';
import { redisConfig } from '@app/config';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './cache.constants.js';
import { CacheService } from './cache.service.js';
import { RedisService } from './redis.service.js';

/**
 * 创建 ioredis 客户端。
 *
 * 未启用时返回 `null`：由 `RedisService` 负责「不连接、访问即明确报错」，
 * 这样启用开关只影响这一处，业务侧不需要到处判空。
 */
function createRedisClient(config: RedisConfig): null | Redis {
  if (!config.enabled) {
    return null;
  }

  return new Redis(config.url, {
    // 延迟连接：由 RedisService.onModuleInit 主动发起，把「连接」纳入 Nest 生命周期
    lazyConnect: true,
    connectTimeout: config.connectTimeout,
    commandTimeout: config.commandTimeout,
    // 断线后单条命令的重试上限。默认 20 会让请求长时间挂起，缓存场景下快速失败更合理
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    // 连接就绪校验（确认 Redis 已加载完持久化数据）
    enableReadyCheck: true,
    // 断线期间允许命令排队、重连后补发；配合上面的重试上限避免无限堆积
    enableOfflineQueue: true,
    // 自动流水线：同一 tick 内发出的多条命令合并为一次往返，批量写入显著降低 RTT
    enableAutoPipelining: true,
    // TCP keep-alive，避免中间设备静默回收空闲连接
    keepAlive: 30_000,
    // 指数退避重连，上限 3s；返回 null 会停止重连，而缓存应当持续自愈
    retryStrategy: (times: number) => Math.min(times * 200, 3_000),
    // 密码：连接串已含密码时不要重复传，显式传 undefined 会覆盖 URL 里的凭据
    ...(config.password === undefined ? {} : { password: config.password }),
  });
}

/**
 * 全局缓存模块（Redis 集成 + 封装）。
 *
 * 为什么标 @Global：缓存属于典型的「全局基础设施」，业务模块注入 CacheService 时
 * 不必逐个 import CacheModule，接入成本最低；代价是依赖关系不再显式。
 *
 * 接入方式（app.module.ts）：
 *   imports: [..., CacheModule.forRoot()]
 *
 * 未启用时（`REDIS_ENABLED=false`，也是默认值）不建立任何连接；此时访问缓存会抛出
 * 明确的「未启用」错误，而不是静默失败——后者会让「以为缓存生效、其实没生效」极难排查。
 */
@Global()
@Module({})
export class CacheModule {
  static forRoot(): DynamicModule {
    return {
      module: CacheModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: createRedisClient,
          inject: [redisConfig.KEY],
        },
        RedisService,
        CacheService,
      ],
      exports: [RedisService, CacheService],
    };
  }
}
