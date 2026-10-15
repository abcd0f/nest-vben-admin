import type { AuthConfig } from '@app/config';
import { randomUUID } from 'node:crypto';
import { authConfig } from '@app/config';
import { BusinessException, ResultCode } from '@app/core';
import { PrismaService } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from './password.js';
import { RefreshTokenStore } from './refresh-token.store.js';

const TOKEN_VERSION = 2;

export interface AuthIdentity {
  userId: bigint;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  expiresAt: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
    private readonly refreshTokens: RefreshTokenStore,
  ) {}

  hashPassword = hashPassword;
  verifyPassword = verifyPassword;

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({ where: { username, status: 1, isDel: 0 } });
    if (!user || !(await verifyPassword(password, user.password))) {
      throw BusinessException.of(ResultCode.LOGIN_FAILED);
    }
    const result = this.issueAccessToken(user.userId);
    if (!this.config.refreshToken.enabled) return result;

    const sessionId = randomUUID();
    const tokenId = randomUUID();
    const refreshToken = this.issueRefreshToken(user.userId, sessionId, tokenId);
    await this.refreshTokens.create(sessionId, tokenId, this.config.refreshToken.ttlSeconds);
    return { ...result, refreshToken };
  }

  async refresh(token: string) {
    if (!this.config.refreshToken.enabled) {
      throw BusinessException.of(ResultCode.OPERATION_NOT_ALLOWED, '刷新令牌功能未启用');
    }
    const payload = this.verifyJwt(token);
    if (
      !this.validIdentity(payload) ||
      payload.tokenType !== 'refresh' ||
      typeof payload.sessionId !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(payload.sessionId) ||
      typeof payload.jti !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(payload.jti)
    ) {
      throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    }

    const userId = BigInt(payload.sub);
    await this.assertActiveUser(userId);
    const nextTokenId = randomUUID();
    const refreshToken = this.issueRefreshToken(userId, payload.sessionId, nextTokenId);
    const rotated = await this.refreshTokens.rotate(
      payload.sessionId,
      payload.jti,
      nextTokenId,
      this.config.refreshToken.ttlSeconds,
    );
    if (!rotated) throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    return { ...this.issueAccessToken(userId), refreshToken };
  }

  verifyToken(token: string): AuthIdentity {
    const payload = this.verifyJwt(token);
    if (!this.validIdentity(payload) || (payload.tokenType !== undefined && payload.tokenType !== 'access')) {
      throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    }
    return { userId: BigInt(payload.sub) };
  }

  private verifyJwt(token: string): unknown {
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
    return payload;
  }

  private validIdentity(payload: unknown): payload is {
    sub: string;
    exp: number;
    tokenVersion: number;
    tokenType?: string;
    sessionId?: string;
    jti?: string;
  } {
    return typeof payload === 'object' && payload !== null && 'sub' in payload && 'exp' in payload
      && 'tokenVersion' in payload && payload.tokenVersion === TOKEN_VERSION
      && typeof payload.sub === 'string' && /^\d+$/.test(payload.sub)
      && typeof payload.exp === 'number' && Number.isInteger(payload.exp);
  }

  private issueAccessToken(userId: bigint): AuthTokenResponse {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.config.tokenTtlSeconds;
    return {
      accessToken: this.jwt.sign({ sub: userId.toString(), tokenVersion: TOKEN_VERSION, tokenType: 'access', iat: issuedAt }),
      tokenType: 'Bearer',
      expiresIn: this.config.tokenTtlSeconds,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  private issueRefreshToken(userId: bigint, sessionId: string, tokenId: string): string {
    return this.jwt.sign(
      { sub: userId.toString(), tokenVersion: TOKEN_VERSION, tokenType: 'refresh', sessionId, jti: tokenId },
      { expiresIn: this.config.refreshToken.ttlSeconds },
    );
  }

  async assertActiveUser(userId: bigint) {
    const user = await this.prisma.user.findFirst({ where: { userId, status: 1, isDel: 0 } });
    if (!user) throw BusinessException.unauthorized();
    return user;
  }
}
