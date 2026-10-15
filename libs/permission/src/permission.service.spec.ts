import type { PrismaService } from '@app/database';
import { PermissionService } from './permission.service.js';

describe('permissionService', () => {
  it('returns distinct permission codes from active granted actions', async () => {
    const prisma = {
      roleMenu: { findMany: vi.fn().mockResolvedValue([{ menu: { permissionCode: 'system:user:list' } }, { menu: { permissionCode: 'system:user:list' } }, { menu: { permissionCode: null } }]) },
    } as unknown as PrismaService;
    await expect(new PermissionService(prisma).getUserPermissionCodes(1n)).resolves.toEqual(['system:user:list']);
    expect(prisma.roleMenu.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        role: { users: { some: { userId: 1n, user: { status: 1, isDel: 0 } } }, status: 1, isDel: 0 },
        menu: { menuType: 'ACTION', status: 1, isDel: 0, permissionCode: { not: null } },
      }),
    }));
  });
});
