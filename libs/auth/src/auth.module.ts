import type { AuthConfig } from '@app/config';
import { authConfig } from '@app/config';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (config: AuthConfig) => ({
        secret: config.secret,
        signOptions: { algorithm: 'HS256', expiresIn: config.tokenTtlSeconds },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
