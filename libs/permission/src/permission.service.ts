import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { DataScope } from '@app/database/generated/prisma/client.js';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissionCodes(userId: bigint): Promise<string[]> {
    const rows = await this.prisma.roleMenu.findMany({
      where: {
        role: { users: { some: { userId, user: { status: 1, deletedAt: null } } }, status: 1, deletedAt: null },
        menu: { menuType: 'ACTION', status: 1, deletedAt: null, permissionCode: { not: null } },
      },
      select: { menu: { select: { permissionCode: true } } },
    });
    return [...new Set(rows.map((row) => row.menu.permissionCode).filter((code): code is string => code !== null))];
  }

  async hasPermission(userId: bigint, permissionCode: string): Promise<boolean> {
    const row = await this.prisma.roleMenu.findFirst({
      where: {
        role: { users: { some: { userId } }, status: 1, deletedAt: null },
        menu: { permissionCode, menuType: 'ACTION', status: 1, deletedAt: null },
      },
      select: { roleId: true },
    });
    return row !== null;
  }

  async isSystemAdmin(userId: bigint): Promise<boolean> {
    const role = await this.prisma.userRole.findFirst({ where: { userId, role: { isSystem: true, status: 1, deletedAt: null } } });
    return role !== null;
  }

  async getDataScope(userId: bigint, permissionCode: string) {
    const roles = await this.prisma.userRole.findMany({
      where: {
        userId,
        user: { status: 1, deletedAt: null },
        role: {
          status: 1,
          deletedAt: null,
          menus: { some: { menu: { permissionCode, menuType: 'ACTION', status: 1, deletedAt: null } } },
        },
      },
      select: { role: { select: { dataScope: true, depts: { select: { deptId: true } } } } },
    });
    const user = await this.prisma.user.findFirst({ where: { userId, status: 1, deletedAt: null }, select: { deptId: true } });
    const deptIds = new Set<bigint>();
    let all = false;
    let self = false;
    for (const { role } of roles) {
      if (role.dataScope === DataScope.ALL) all = true;
      if (role.dataScope === DataScope.SELF) self = true;
      if (role.dataScope === DataScope.DEPT && user?.deptId !== null && user?.deptId !== undefined) deptIds.add(user.deptId);
      if (role.dataScope === DataScope.CUSTOM) role.depts.forEach(({ deptId }) => deptIds.add(deptId));
      if (role.dataScope === DataScope.DEPT_AND_CHILDREN && user?.deptId !== null && user?.deptId !== undefined) {
        const descendants = await this.findDescendants(user.deptId);
        descendants.forEach((id) => deptIds.add(id));
      }
    }
    return { all, self, deptIds };
  }

  private async findDescendants(root: bigint): Promise<bigint[]> {
    const result = [root];
    const queue = [root];
    while (queue.length > 0) {
      const children = await this.prisma.dept.findMany({ where: { parentId: { in: queue.splice(0) }, status: 1, deletedAt: null }, select: { deptId: true } });
      result.push(...children.map((child) => child.deptId));
      queue.push(...children.map((child) => child.deptId));
    }
    return result;
  }

  async getUserMenus(userId: bigint) {
    return this.prisma.roleMenu.findMany({
      where: {
        role: { users: { some: { userId, user: { status: 1, deletedAt: null } } }, status: 1, deletedAt: null },
        menu: { status: 1, deletedAt: null },
      },
      distinct: ['menuId'],
      orderBy: [{ menu: { sortOrder: 'asc' } }, { menuId: 'asc' }],
      select: { menu: true },
    }).then((rows) =>
      rows.map(({ menu }) => ({
        ...menu,
        menuId: menu.menuId.toString(),
        parentId: menu.parentId?.toString() ?? null,
      })),
    );
  }
}
