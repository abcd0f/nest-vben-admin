import type { AuthConfig } from '@app/config';
import { AppConfigModule, authConfig } from '@app/config';
import { BusinessException, ResultCode } from '@app/core';
import { PrismaService } from '@app/database';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';
import { RefreshTokenStore } from './refresh-token.store.js';

describe('authService JWT contract', () => {
  let service: AuthService;
  let jwt: JwtService;
  let fixtureJwt: JwtService;
  let findFirst: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    findFirst = vi.fn();
    const module = await Test.createTestingModule({
      imports: [AppConfigModule.forRoot(), AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findFirst } })
      .overrideProvider(RefreshTokenStore)
      .useValue({ create: vi.fn(), rotate: vi.fn().mockResolvedValue(true) })
      .compile();

    service = module.get(AuthService);
    jwt = module.get(JwtService);
    fixtureJwt = new JwtService({ secret: module.get<AuthConfig>(authConfig.KEY).secret });
  });

  it('issues a versioned token with a matching expiry and verifies its identity', async () => {
    findFirst.mockResolvedValue({ userId: 9007199254740993n, password: await hashPassword('P@ssw0rd') });

    const result = await service.login('test-user', 'P@ssw0rd');
    const payload = jwt.verify<{ sub: string; iat: number; exp: number; tokenVersion: number }>(result.accessToken);

    expect(payload).toMatchObject({ sub: '9007199254740993', tokenVersion: 2 });
    expect(result.tokenType).toBe('Bearer');
    expect(payload.exp).toBe(Date.parse(result.expiresAt) / 1000);
    expect(payload.exp - payload.iat).toBe(result.expiresIn);
    expect(result.refreshToken).toBeUndefined();
    expect(service.verifyToken(result.accessToken)).toEqual({ userId: 9007199254740993n });
  });

  it('rejects previously issued tokens without the version claim', () => {
    const oldToken = fixtureJwt.sign({ sub: '123', exp: Math.floor(Date.now() / 1000) + 60 }, { noTimestamp: true });

    try {
      service.verifyToken(oldToken);
      throw new Error('expected token rejection');
    } catch (error) {
      expect(error).toMatchObject({ code: ResultCode.TOKEN_INVALID });
      expect((error as BusinessException).getStatus()).toBe(401);
    }
  });

  it('distinguishes expired tokens from malformed and tampered tokens', () => {
    const expired = jwt.sign({ sub: '123', tokenVersion: 2 }, { expiresIn: -1 });
    const valid = jwt.sign({ sub: '123', tokenVersion: 2 });
    const parts = valid.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;

    for (const [token, code] of [
      [expired, ResultCode.TOKEN_EXPIRED],
      ['bad-token', ResultCode.TOKEN_INVALID],
      [tampered, ResultCode.TOKEN_INVALID],
    ] as const) {
      try {
        service.verifyToken(token);
        throw new Error('expected token rejection');
      } catch (error) {
        expect(error).toMatchObject({ code });
        expect((error as BusinessException).getStatus()).toBe(401);
      }
    }
  });

  it('rejects unapproved algorithms and invalid identity claims', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const invalidTokens = [
      fixtureJwt.sign({ sub: '123', tokenVersion: 2, exp }, { algorithm: 'HS384' }),
      fixtureJwt.sign({ sub: '123', tokenVersion: 3, exp }),
      fixtureJwt.sign({ sub: 123, tokenVersion: 2, exp }),
      fixtureJwt.sign({ sub: 'abc', tokenVersion: 2, exp }),
      fixtureJwt.sign({ sub: '123', tokenVersion: 2 }),
      fixtureJwt.sign({ sub: '123', tokenVersion: 2, exp, nbf: exp }),
    ];

    for (const token of invalidTokens) {
      expect(() => service.verifyToken(token)).toThrowError(
        expect.objectContaining({ code: ResultCode.TOKEN_INVALID }),
      );
    }
  });

  it('rotates refresh tokens and rejects the consumed token', async () => {
    const store = { create: vi.fn(), rotate: vi.fn().mockResolvedValue(true) };
    const config = {
      secret: 'test-secret',
      tokenTtlSeconds: 60,
      refreshToken: { enabled: true, ttlSeconds: 120 },
    };
    const prisma = { user: { findFirst } } as never;
    const auth = new AuthService(prisma, new JwtService({
      secret: config.secret,
      signOptions: { algorithm: 'HS256', expiresIn: config.tokenTtlSeconds },
      verifyOptions: { algorithms: ['HS256'] },
    }), config, store as never);
    findFirst.mockResolvedValue({ userId: 123n, password: await hashPassword('P@ssw0rd') });

    const login = await auth.login('test-user', 'P@ssw0rd');
    const refreshToken = login.refreshToken;
    expect(refreshToken).toBeDefined();
    expect(login).toHaveProperty('refreshToken');
    const refreshed = await auth.refresh(refreshToken!);

    expect(store.create).toHaveBeenCalledOnce();
    expect(store.rotate).toHaveBeenCalledOnce();
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    expect(() => auth.verifyToken(refreshToken!)).toThrowError(
      expect.objectContaining({ code: ResultCode.TOKEN_INVALID }),
    );
    store.rotate.mockResolvedValue(false);
    await expect(auth.refresh(refreshToken!)).rejects.toMatchObject({ code: ResultCode.TOKEN_INVALID });

    findFirst.mockResolvedValue(null);
    store.rotate.mockClear();
    await expect(auth.refresh(refreshed.refreshToken!)).rejects.toMatchObject({ code: ResultCode.UNAUTHORIZED });
    expect(store.rotate).not.toHaveBeenCalled();
  });

  it('rejects unsupported token types as access tokens', () => {
    const token = jwt.sign({ sub: '123', tokenVersion: 2, tokenType: 'other' });
    expect(() => service.verifyToken(token)).toThrowError(
      expect.objectContaining({ code: ResultCode.TOKEN_INVALID }),
    );
  });

  it('requires Redis when refresh tokens are enabled', async () => {
    await expect(Test.createTestingModule({ imports: [AppConfigModule.forRoot(), AuthModule] })
      .overrideProvider(authConfig.KEY)
      .useValue({ secret: 'test-secret', tokenTtlSeconds: 60, refreshToken: { enabled: true, ttlSeconds: 120 } })
      .overrideProvider(PrismaService)
      .useValue({ user: { findFirst } })
      .overrideProvider(RefreshTokenStore)
      .useValue({ create: vi.fn(), rotate: vi.fn() })
      .compile()).rejects.toThrow('redis.enabled');
  });

  it('rejects refresh requests when the feature is disabled', async () => {
    await expect(service.refresh('any-token')).rejects.toMatchObject({ code: ResultCode.OPERATION_NOT_ALLOWED });
  });
});
