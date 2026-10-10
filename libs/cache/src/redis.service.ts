import type { RedisConfig } from '@app/config';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { redisConfig } from '@app/config';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from './cache.constants.js';

/** 连通性探测结果 */
export interface RedisHealth {
  /** `disabled` 表示未启用 Redis（REDIS_ENABLED=false），不是故障 */
  status: 'disabled' | 'down' | 'up';
  latencyMs: number;
  error?: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Redis 客户端（由 Nest 托管生命周期）。
 *
 * 设计要点：
 * 1. **全进程单实例复用**。ioredis 用一条 TCP 连接多路复用，内部自动做命令流水线，
 *    因此一个进程只需要一个客户端。业务代码**不要**自己 `new Redis()`——那会绕开
 *    生命周期管理、连接数随并发线性上涨，还会各自维护一份重连状态。
 * 2. **连接失败不阻塞启动**。缓存是非关键路径：`onModuleInit` 只发起连接，
 *    失败仅记 warn，交由 `retryStrategy` 在后台退避重连，应用照常启动。
 * 3. **必须挂 `error` 监听器**。ioredis 在连接出错时会 emit `error`，
 *    没有监听器会被 Node 当成未捕获事件直接打崩进程。
 * 4. 未启用时（`REDIS_ENABLED=false`）不建立任何连接，访问 `client` 会明确报错——
 *    静默降级会让「以为缓存生效、其实没生效」这类问题极难排查。
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: null | Redis,
    @Inject(redisConfig.KEY) private readonly config: RedisConfig,
  ) {}

  /** 是否已启用 Redis 集成 */
  get enabled(): boolean {
    return this.redis !== null;
  }

  /**
   * 原始 ioredis 客户端（命令逃生口）。
   *
   * 需要 Hash / List / Set / Pub-Sub / 自定义 Lua 等门面未覆盖的能力时，从这里取客户端直接用。
   * 注意：直接使用时键**不会**自动加命名空间前缀，需要自己保证键名规范。
   */
  get client(): Redis {
    if (this.redis === null) {
      throw new Error('Redis 未启用（REDIS_ENABLED=false）：请先在环境变量中开启 Redis 后再使用缓存');
    }

    return this.redis;
  }

  onModuleInit(): void {
    if (this.redis === null) {
      this.logger.warn('Redis 未启用（REDIS_ENABLED=false），缓存与分布式锁不可用');
      return;
    }

    this.attachListeners();

    // 只发起连接、不 await：连接失败不应阻塞应用启动。
    this.redis.connect().catch((error: unknown) => {
      this.logger.warn(`Redis 首次连接失败，将按退避策略在后台重试：${toErrorMessage(error)}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.redis;

    if (client === null || client.status === 'end') {
      return;
    }

    // quit() 会等未完成的命令发完再断开；断线状态下会立即 reject，退回强制断开。
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }

  /** 连通性探测，返回耗时，供健康检查接口使用 */
  async health(): Promise<RedisHealth> {
    if (this.redis === null) {
      return { status: 'disabled', latencyMs: 0 };
    }

    const startedAt = Date.now();

    try {
      await this.redis.ping();
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { status: 'down', latencyMs: Date.now() - startedAt, error: toErrorMessage(error) };
    }
  }

  /** 连接事件 → 日志。所有分支都挂上，`error` 漏挂会打崩进程。 */
  private attachListeners(): void {
    const client = this.redis;

    if (client === null) {
      return;
    }

    client.on('ready', () => {
      this.logger.log(`Redis 连接就绪（${this.describeTarget()}）`);
    });
    client.on('reconnecting', () => {
      this.logger.warn('Redis 连接断开，正在重连…');
    });
    client.on('end', () => {
      this.logger.warn('Redis 连接已关闭');
    });
    client.on('error', (error: Error) => {
      this.logger.warn(`Redis 连接异常：${error.message}`);
    });
  }

  /** 日志里只暴露地址与库号，隐去凭据 */
  private describeTarget(): string {
    try {
      const url = new URL(this.config.url);
      const database = url.pathname.replace('/', '') || '0';
      return `${url.hostname}:${url.port || '6379'}/${database}`;
    } catch {
      return 'redis';
    }
  }
}
