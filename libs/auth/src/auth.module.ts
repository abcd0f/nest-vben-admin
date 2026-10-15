import type { AuthConfig, RedisConfig } from '@app/config';
import { authConfig, redisConfig } from '@app/config';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { RefreshTokenStore } from './refresh-token.store.js';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY, redisConfig.KEY],
      useFactory: (config: AuthConfig, redis: RedisConfig) => {
        if (config.refreshToken.enabled && !redis.enabled) {
          throw new Error('auth.refresh-token.enabled 为 true 时必须启用 redis.enabled');
        }
        return {
          secret: config.secret,
          signOptions: { algorithm: 'HS256', expiresIn: config.tokenTtlSeconds },
          verifyOptions: { algorithms: ['HS256'] },
        };
      },
    }),
  ],
  providers: [AuthService, RefreshTokenStore],
  exports: [AuthService],
})
export class AuthModule {}
