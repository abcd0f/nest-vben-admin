import type { RedisConfig } from '@app/config';
import { RedisService } from '@app/cache';
import { redisConfig } from '@app/config';
import { Inject, Injectable } from '@nestjs/common';

// 同一会话只接受当前 jti。比较与替换在 Redis 内原子执行，并发刷新只能有一个成功。
const ROTATE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

@Injectable()
export class RefreshTokenStore {
  constructor(
    private readonly redis: RedisService,
    @Inject(redisConfig.KEY) private readonly config: RedisConfig,
  ) {}

  async create(sessionId: string, tokenId: string, ttlSeconds: number): Promise<void> {
    const result = await this.redis.client.set(this.key(sessionId), tokenId, 'EX', ttlSeconds, 'NX');
    if (result !== 'OK') throw new Error('刷新令牌会话创建失败');
  }

  async rotate(sessionId: string, oldTokenId: string, newTokenId: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.client.eval(
      ROTATE_SCRIPT,
      1,
      this.key(sessionId),
      oldTokenId,
      newTokenId,
      ttlSeconds,
    );
    return Number(result) === 1;
  }

  private key(sessionId: string): string {
    return `${this.config.keyPrefix}:auth:refresh:${sessionId}`;
  }
}
