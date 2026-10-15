import type { AuthConfig } from '@app/config';
import { AppConfigModule, authConfig } from '@app/config';
import { BusinessException, ResultCode } from '@app/core';
import { PrismaService } from '@app/database';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';

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
});
