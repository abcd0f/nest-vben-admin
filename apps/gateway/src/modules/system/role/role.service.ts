import { toDto } from '@app/common';
import { BusinessException } from '@app/core';
import { PrismaService } from '@app/database';
import { Injectable } from '@nestjs/common';

import { CreateRoleDto, DataScope, ReplaceIdsDto, RoleResponseDto, UpdateRoleDto } from './role.dto.js';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.role.findMany({ where: { deletedAt: null }, orderBy: [{ roleId: 'asc' }] });
    return rows.map((row) => toDto(RoleResponseDto, row));
  }

  async findOne(roleId: bigint) {
    const row = await this.prisma.role.findFirst({ where: { roleId, deletedAt: null } });
    if (row === null) throw BusinessException.notFound('角色不存在');
    return toDto(RoleResponseDto, row)!;
  }

  async create(dto: CreateRoleDto) {
    const row = await this.prisma.role.create({
      data: {
        roleCode: dto.roleCode,
        roleName: dto.roleName,
        dataScope: dto.dataScope ?? DataScope.SELF,
        status: dto.status ?? 1,
      },
    });
    return toDto(RoleResponseDto, row)!;
  }

  async update(roleId: bigint, dto: UpdateRoleDto) {
    const current = await this.prisma.role.findFirst({ where: { roleId, deletedAt: null } });
    if (current === null) throw BusinessException.notFound('角色不存在');
    if (current.isSystem && dto.status === 0) throw BusinessException.conflict('系统角色不能停用');
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { roleId }, data: dto });
      if (dto.dataScope !== undefined && dto.dataScope !== DataScope.CUSTOM) {
        await tx.roleDept.deleteMany({ where: { roleId } });
      }
      return updated;
    });
    return toDto(RoleResponseDto, row)!;
  }

  async remove(roleId: bigint) {
    const current = await this.prisma.role.findFirst({ where: { roleId, deletedAt: null } });
    if (current === null) throw BusinessException.notFound('角色不存在');
    if (current.isSystem) throw BusinessException.conflict('系统角色不能删除');
    await this.prisma.role.update({ where: { roleId }, data: { deletedAt: new Date() } });
  }

  async replaceUserPosts(userId: bigint, dto: ReplaceIdsDto) {
    await this.assertUser(userId);
    const postIds = this.parseIds(dto.ids);
    await this.assertActivePosts(postIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.userPost.deleteMany({ where: { userId } });
      if (postIds.length > 0) await tx.userPost.createMany({ data: postIds.map((postId) => ({ userId, postId })) });
    });
  }

  async replaceUserRoles(userId: bigint, dto: ReplaceIdsDto) {
    await this.assertUser(userId);
    const roleIds = this.parseIds(dto.ids);
    await this.assertActiveRoles(roleIds);
    const currentSystem = await this.prisma.userRole?.findFirst({
      where: { userId, role: { isSystem: true, status: 1, deletedAt: null } },
    });
    const retainsSystem =
      roleIds.length > 0 &&
      (await this.prisma.role.count({
        where: { roleId: { in: roleIds }, isSystem: true, status: 1, deletedAt: null },
      })) > 0;
    if (currentSystem && !retainsSystem) {
      const administrators =
        (await this.prisma.userRole?.count({
          where: { role: { isSystem: true, status: 1, deletedAt: null }, user: { status: 1, deletedAt: null } },
        })) ?? 2;
      if (administrators <= 1) throw BusinessException.conflict('不能解绑最后一个有效授权管理员');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      if (roleIds.length > 0) await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) });
    });
  }

  async replaceRoleDepts(roleId: bigint, dto: ReplaceIdsDto) {
    const role = await this.prisma.role.findFirst({ where: { roleId, deletedAt: null } });
    if (role === null) throw BusinessException.notFound('角色不存在');
    if (role.dataScope !== DataScope.CUSTOM)
      throw BusinessException.badRequest('只有 CUSTOM 数据范围的角色可以配置部门');
    const deptIds = this.parseIds(dto.ids);
    await this.assertActiveDepts(deptIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.roleDept.deleteMany({ where: { roleId } });
      if (deptIds.length > 0) await tx.roleDept.createMany({ data: deptIds.map((deptId) => ({ roleId, deptId })) });
    });
  }

  async findRoleMenus(roleId: bigint) {
    await this.assertRole(roleId);
    const rows = await this.prisma.roleMenu.findMany({
      where: { roleId },
      select: { menuId: true },
      orderBy: { menuId: 'asc' },
    });
    return rows.map((row) => row.menuId.toString());
  }

  async replaceRoleMenus(roleId: bigint, dto: ReplaceIdsDto) {
    await this.assertRole(roleId);
    const menuIds = this.parseIds(dto.ids);
    const count = await this.prisma.menu.count({ where: { menuId: { in: menuIds }, status: 1, deletedAt: null } });
    if (count !== menuIds.length) throw BusinessException.badRequest('菜单不存在、已停用或已删除');
    await this.prisma.$transaction(async (tx) => {
      await tx.roleMenu.deleteMany({ where: { roleId } });
      if (menuIds.length > 0) await tx.roleMenu.createMany({ data: menuIds.map((menuId) => ({ roleId, menuId })) });
    });
  }

  private parseIds(values: string[]): bigint[] {
    return values.map((value) => BigInt(value));
  }

  private async assertUser(userId: bigint) {
    const user = await this.prisma.user.findFirst({ where: { userId, status: 1, deletedAt: null } });
    if (user === null) throw BusinessException.badRequest('用户不存在、已停用或已删除');
  }

  private async assertRole(roleId: bigint) {
    const role = await this.prisma.role.findFirst({ where: { roleId, status: 1, deletedAt: null } });
    if (role === null) throw BusinessException.badRequest('角色不存在、已停用或已删除');
  }

  private async assertActivePosts(ids: bigint[]) {
    const count = await this.prisma.post.count({ where: { postId: { in: ids }, status: 1, deletedAt: null } });
    if (count !== ids.length) throw BusinessException.badRequest('岗位不存在、已停用或已删除');
  }

  private async assertActiveRoles(ids: bigint[]) {
    const count = await this.prisma.role.count({ where: { roleId: { in: ids }, status: 1, deletedAt: null } });
    if (count !== ids.length) throw BusinessException.badRequest('角色不存在、已停用或已删除');
  }

  private async assertActiveDepts(ids: bigint[]) {
    const count = await this.prisma.dept.count({ where: { deptId: { in: ids }, status: 1, deletedAt: null } });
    if (count !== ids.length) throw BusinessException.badRequest('部门不存在、已停用或已删除');
  }
}
