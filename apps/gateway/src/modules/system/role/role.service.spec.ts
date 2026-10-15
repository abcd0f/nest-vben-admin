import type { PrismaService } from '@app/database';
import { BusinessException } from '@app/core';
import { DataScope } from '@app/database/generated/prisma/client.js';
import { RoleService } from './role.service.js';

describe('roleService', () => {
  it('replaces user roles in one transaction after validating every role', async () => {
    const tx = {
      userRole: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ userId: 1n }) },
      role: { count: vi.fn().mockResolvedValue(2) },
      $transaction: vi.fn((callback) => callback(tx)),
    } as unknown as PrismaService;

    await new RoleService(prisma).replaceUserRoles(1n, { ids: ['2', '3'] });

    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 1n } });
    expect(tx.userRole.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 1n, roleId: 2n },
        { userId: 1n, roleId: 3n },
      ],
    });
  });

  it('rejects the whole replacement when one target is inactive', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ userId: 1n }) },
      role: { count: vi.fn().mockResolvedValue(1) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;

    await expect(new RoleService(prisma).replaceUserRoles(1n, { ids: ['2', '3'] })).rejects.toBeInstanceOf(
      BusinessException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('clears custom department rows when a role changes to a fixed scope', async () => {
    const tx = {
      role: { update: vi.fn().mockResolvedValue({ roleId: 1n, dataScope: DataScope.DEPT }) },
      roleDept: { deleteMany: vi.fn() },
    };
    const prisma = {
      role: { findFirst: vi.fn().mockResolvedValue({ roleId: 1n, isSystem: false }) },
      $transaction: vi.fn((callback) => callback(tx)),
    } as unknown as PrismaService;

    await new RoleService(prisma).update(1n, { dataScope: DataScope.DEPT });

    expect(tx.roleDept.deleteMany).toHaveBeenCalledWith({ where: { roleId: 1n } });
  });

  it('rejects department assignments for non-custom roles', async () => {
    const prisma = {
      role: { findFirst: vi.fn().mockResolvedValue({ roleId: 1n, dataScope: DataScope.DEPT, isDel: 0 }) },
    } as unknown as PrismaService;

    await expect(new RoleService(prisma).replaceRoleDepts(1n, { ids: ['2'] })).rejects.toBeInstanceOf(BusinessException);
  });

  it('replaces role menus only after validating every active menu', async () => {
    const tx = { roleMenu: { deleteMany: vi.fn(), createMany: vi.fn() } };
    const prisma = {
      role: { findFirst: vi.fn().mockResolvedValue({ roleId: 1n, status: 1, isDel: 0 }) },
      menu: { count: vi.fn().mockResolvedValue(2) },
      $transaction: vi.fn((callback) => callback(tx)),
    } as unknown as PrismaService;
    await new RoleService(prisma).replaceRoleMenus(1n, { ids: ['2', '3'] });
    expect(tx.roleMenu.deleteMany).toHaveBeenCalledWith({ where: { roleId: 1n } });
    expect(tx.roleMenu.createMany).toHaveBeenCalledWith({ data: [{ roleId: 1n, menuId: 2n }, { roleId: 1n, menuId: 3n }] });
  });

  it('does not start a role menu replacement when a target is inactive', async () => {
    const prisma = {
      role: { findFirst: vi.fn().mockResolvedValue({ roleId: 1n, status: 1, isDel: 0 }) },
      menu: { count: vi.fn().mockResolvedValue(1) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    await expect(new RoleService(prisma).replaceRoleMenus(1n, { ids: ['2', '3'] })).rejects.toBeInstanceOf(BusinessException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
