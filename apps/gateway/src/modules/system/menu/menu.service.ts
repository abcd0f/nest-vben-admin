import { toDto } from '@app/common';
import { BusinessException } from '@app/core';
import { Prisma, PrismaService } from '@app/database';
import { Injectable } from '@nestjs/common';
import { Exclude, Expose, Transform } from 'class-transformer';
import { MenuDto, MenuType, UpdateMenuDto } from './menu.dto.js';

@Exclude()
export class MenuResponseDto {
  @Expose() @Transform(({ value }) => value.toString()) menuId!: string;
  @Expose() @Transform(({ value }) => value?.toString() ?? null) parentId!: string | null;
  @Expose() menuType!: MenuType;
  @Expose() menuName!: string;
  @Expose() routePath!: string | null;
  @Expose() component!: string | null;
  @Expose() permissionCode!: string | null;
  @Expose() sortOrder!: number;
  @Expose() status!: number;
  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.menu.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { menuId: 'asc' }],
    });
    return rows.map((row) => toDto(MenuResponseDto, row));
  }

  async findOne(menuId: bigint) {
    const row = await this.prisma.menu.findFirst({ where: { menuId, deletedAt: null } });
    if (row === null) throw BusinessException.notFound('菜单不存在');
    return toDto(MenuResponseDto, row)!;
  }

  async create(dto: MenuDto) {
    const data = await this.prepareData(dto);
    const row = await this.prisma.menu.create({
      data: {
        ...data,
        parentId: data.parentId ?? null,
        menuType: dto.menuType,
        menuName: dto.menuName,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 1,
      } as Prisma.MenuUncheckedCreateInput,
    });
    return toDto(MenuResponseDto, row)!;
  }

  async update(menuId: bigint, dto: UpdateMenuDto) {
    const current = await this.prisma.menu.findFirst({ where: { menuId, deletedAt: null } });
    if (current === null) throw BusinessException.notFound('菜单不存在');
    const data = await this.prepareData(dto, menuId, current);
    const row = await this.prisma.menu.update({ where: { menuId }, data });
    return toDto(MenuResponseDto, row)!;
  }

  async remove(menuId: bigint) {
    const current = await this.prisma.menu.findFirst({ where: { menuId, deletedAt: null } });
    if (current === null) throw BusinessException.notFound('菜单不存在');
    const [children, roles] = await Promise.all([
      this.prisma.menu.count({ where: { parentId: menuId, deletedAt: null } }),
      this.prisma.roleMenu.count({ where: { menuId } }),
    ]);
    if (children > 0 || roles > 0) throw BusinessException.conflict('菜单仍有子节点或角色授权，不能删除');
    await this.prisma.menu.update({ where: { menuId }, data: { deletedAt: new Date() } });
  }

  private async prepareData(
    dto: MenuDto | UpdateMenuDto,
    menuId?: bigint,
    current?: { menuType: MenuType; permissionCode: string | null; parentId: bigint | null },
  ) {
    const parentId = dto.parentId === undefined ? undefined : dto.parentId === null ? null : BigInt(dto.parentId);
    if (parentId !== undefined && parentId !== null) {
      if (parentId === menuId) throw BusinessException.badRequest('菜单不能设置自身为上级');
      await this.assertActiveParent(parentId);
      if (menuId !== undefined && (await this.hasDescendant(parentId, menuId)))
        throw BusinessException.badRequest('不能将菜单移动到自己的下级');
    }
    const menuType = dto.menuType ?? current?.menuType;
    const permissionCode = dto.permissionCode === undefined ? current?.permissionCode : dto.permissionCode;
    if (menuType === MenuType.ACTION && !permissionCode) throw BusinessException.badRequest('操作项必须设置权限码');
    if (menuType !== MenuType.ACTION && permissionCode !== null && permissionCode !== undefined)
      throw BusinessException.badRequest('目录和页面菜单不能设置权限码');
    const effectiveParentId = parentId === undefined ? current?.parentId : parentId;
    if (effectiveParentId !== undefined && effectiveParentId !== null && menuType !== undefined) {
      const parent = await this.prisma.menu.findFirst({
        where: { menuId: effectiveParentId },
        select: { menuType: true },
      });
      const validParent =
        (menuType === MenuType.MENU && parent?.menuType === MenuType.DIRECTORY) ||
        (menuType === MenuType.ACTION && parent?.menuType === MenuType.MENU);
      if (!validParent) throw BusinessException.badRequest('菜单父子类型关系无效');
    }
    if (menuId !== undefined && menuType !== undefined) {
      const children = await this.prisma.menu.findMany({
        where: { parentId: menuId, deletedAt: null },
        select: { menuType: true },
      });
      const validChildren = children.every(
        (child) =>
          (menuType === MenuType.DIRECTORY && child.menuType === MenuType.MENU) ||
          (menuType === MenuType.MENU && child.menuType === MenuType.ACTION),
      );
      if (!validChildren) throw BusinessException.conflict('菜单类型变更会破坏子节点关系');
    }
    return {
      ...(parentId === undefined ? {} : { parentId }),
      ...(dto.menuType === undefined ? {} : { menuType: dto.menuType }),
      ...(dto.menuName === undefined ? {} : { menuName: dto.menuName }),
      ...(dto.routePath === undefined ? {} : { routePath: dto.routePath }),
      ...(dto.component === undefined ? {} : { component: dto.component }),
      ...(dto.permissionCode === undefined ? {} : { permissionCode: dto.permissionCode }),
      ...(dto.sortOrder === undefined ? {} : { sortOrder: dto.sortOrder }),
      ...(dto.status === undefined ? {} : { status: dto.status }),
    };
  }

  private async assertActiveParent(menuId: bigint) {
    const row = await this.prisma.menu.findFirst({ where: { menuId, status: 1, deletedAt: null } });
    if (row === null) throw BusinessException.badRequest('上级菜单不存在、已停用或已删除');
  }

  private async hasDescendant(candidate: bigint, ancestor: bigint): Promise<boolean> {
    const children = await this.prisma.menu.findMany({
      where: { parentId: ancestor, deletedAt: null },
      select: { menuId: true },
    });
    for (const child of children) {
      if (child.menuId === candidate || (await this.hasDescendant(candidate, child.menuId))) return true;
    }
    return false;
  }
}
