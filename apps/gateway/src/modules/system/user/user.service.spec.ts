import type { PrismaService } from '@app/database';
import { AuthService } from '@app/auth';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service.js';

describe('userService password and ID contract', () => {
  const id = 9007199254740993n;
  const user = {
    userId: id,
    username: 'test-user',
    password: 'stored-hash',
    email: null,
    nickName: null,
    status: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
  };

  it('hashes a new password and returns the full decimal ID', async () => {
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
