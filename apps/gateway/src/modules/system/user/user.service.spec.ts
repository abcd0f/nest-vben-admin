import type { PrismaService } from '@app/database';
import { AuthService } from '@app/auth';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service.js';

describe('userService password and ID contract', () => {
  afterEach(() => vi.unstubAllEnvs());
  const id = 9007199254740993n;
  const user = {
    userId: id,
    username: 'test-user',
    password: 'stored-hash',
    email: null,
    nickName: null,
    status: 1,
    createdTime: new Date('2026-01-01T00:00:00Z'),
    updatedTime: new Date('2026-01-01T00:00:00Z'),
    isDel: 0,
  };

  it('hashes a new password and returns the full decimal ID', async () => {
    vi.stubEnv('SNOWFLAKE_WORKER_ID', '0');
    vi.stubEnv('SNOWFLAKE_DATACENTER_ID', '0');
    const create = vi.fn().mockResolvedValue(user);
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null), create } } as unknown as PrismaService;
    const auth = new AuthService(prisma, new JwtService({ secret: 'test-secret' }), {
      secret: 'test-secret',
      tokenTtlSeconds: 60,
      refreshToken: { enabled: false, ttlSeconds: 60 },
    }, {} as never);
    const service = new UserService(prisma, auth);

    const response = await service.create({ username: 'test-user', password: 'P@ssw0rd' });
    const stored = create.mock.calls[0][0].data.password;
    expect(typeof create.mock.calls[0][0].data.userId).toBe('bigint');

    expect(stored).not.toBe('P@ssw0rd');
    expect(await auth.verifyPassword('P@ssw0rd', stored)).toBe(true);
    expect(response.userId).toBe('9007199254740993');
    expect(response).not.toHaveProperty('password');
  });

  it('never changes the password through the general update path', async () => {
    const update = vi.fn().mockResolvedValue(user);
    const prisma = { user: { findFirst: vi.fn().mockResolvedValue(user), update } } as unknown as PrismaService;
    const auth = new AuthService(prisma, new JwtService({ secret: 'test-secret' }), {
      secret: 'test-secret',
      tokenTtlSeconds: 60,
      refreshToken: { enabled: false, ttlSeconds: 60 },
    }, {} as never);
    const service = new UserService(prisma, auth);

    await service.update(id, { nickName: 'New name', password: 'injected' } as never);

    expect(update).toHaveBeenCalledWith({ where: { userId: id }, data: { nickName: 'New name' } });
  });
});
