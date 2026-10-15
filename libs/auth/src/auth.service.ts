import type { AuthConfig } from '@app/config';
import { authConfig } from '@app/config';
import { BusinessException, ResultCode } from '@app/core';
import { PrismaService } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from './password.js';

const TOKEN_VERSION = 2;

export interface AuthIdentity {
  userId: bigint;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  hashPassword = hashPassword;
  verifyPassword = verifyPassword;

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({ where: { username, status: 1, deletedAt: null } });
    if (!user || !(await verifyPassword(password, user.password))) {
      throw BusinessException.of(ResultCode.LOGIN_FAILED);
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.config.tokenTtlSeconds;
    const accessToken = this.jwt.sign({ sub: user.userId.toString(), tokenVersion: TOKEN_VERSION, iat: issuedAt });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.tokenTtlSeconds,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  verifyToken(token: string): AuthIdentity {
    let payload: unknown;
    try {
      payload = this.jwt.verify(token);
    } catch (error) {
      if (!(error instanceof JsonWebTokenError)) throw error;
      const code =
        error instanceof TokenExpiredError
          ? ResultCode.TOKEN_EXPIRED
          : ResultCode.TOKEN_INVALID;
      throw BusinessException.of(code, undefined, { httpStatus: 401 });
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      !('exp' in payload) ||
      !('tokenVersion' in payload) ||
      payload.tokenVersion !== TOKEN_VERSION ||
      typeof payload.sub !== 'string' ||
      !/^\d+$/.test(payload.sub) ||
      typeof payload.exp !== 'number' ||
      !Number.isInteger(payload.exp)
    ) {
      throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    }
    return { userId: BigInt(payload.sub) };
  }

  async assertActiveUser(userId: bigint) {
    const user = await this.prisma.user.findFirst({ where: { userId, status: 1, deletedAt: null } });
    if (!user) throw BusinessException.unauthorized();
    return user;
  }
}
