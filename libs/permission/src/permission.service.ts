import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';

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
