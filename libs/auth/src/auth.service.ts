import { createHmac, timingSafeEqual } from 'node:crypto';
import { BusinessException, ResultCode } from '@app/core';
import { PrismaService } from '@app/database';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword, verifyPassword } from './password.js';

export interface AuthIdentity {
  userId: bigint;
}

@Injectable()
export class AuthService {
  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  hashPassword = hashPassword;
  verifyPassword = verifyPassword;

  private get secret(): string {
    return this.config?.get<string>('auth.secret') ?? 'development-only-change-me';
  }

  private get ttl(): number {
    return this.config?.get<number>('auth.tokenTtlSeconds') ?? 28_800;
  }

  async login(username: string, password: string) {
    if (!this.prisma) throw BusinessException.internal('认证服务未初始化');
    const user = await this.prisma.user.findFirst({ where: { username, status: 1, deletedAt: null } });
    if (!user || !(await verifyPassword(password, user.password))) {
      throw BusinessException.of(ResultCode.LOGIN_FAILED);
    }
    const expiresAt = Math.floor(Date.now() / 1000) + this.ttl;
    const payload = this.encode({ sub: user.userId.toString(), exp: expiresAt });
    return {
      accessToken: payload,
      tokenType: 'Bearer',
      expiresIn: this.ttl,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  verifyToken(token: string): AuthIdentity {
    const parts = token.split('.');
    if (parts.length !== 3) throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    const input = `${parts[0]}.${parts[1]}`;
    const expected = Buffer.from(this.sign(input), 'base64url');
    const actual = Buffer.from(parts[2], 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    let payload: { sub?: string; exp?: number };
    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { alg?: string; typ?: string };
      if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('header');
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    } catch {
      throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    }
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000))
      throw BusinessException.of(ResultCode.TOKEN_EXPIRED, undefined, { httpStatus: 401 });
    if (!/^\d+$/.test(payload.sub))
      throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    try {
      return { userId: BigInt(payload.sub) };
    } catch {
      throw BusinessException.of(ResultCode.TOKEN_INVALID, undefined, { httpStatus: 401 });
    }
  }

  async assertActiveUser(userId: bigint) {
    if (!this.prisma) throw BusinessException.internal('认证服务未初始化');
    const user = await this.prisma.user.findFirst({ where: { userId, status: 1, deletedAt: null } });
    if (!user) throw BusinessException.unauthorized();
    return user;
  }

  private encode(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.${this.sign(`${header}.${body}`)}`;
  }

  private sign(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('base64url');
  }
}
