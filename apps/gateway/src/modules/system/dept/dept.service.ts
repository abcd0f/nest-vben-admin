import { toDto } from '@app/common';
import { BusinessException } from '@app/core';
import { PrismaService } from '@app/database';
import { Injectable } from '@nestjs/common';
import { DeptDto } from './dto/dept.dto.js';
import { DeptResponseDto } from './dto/response.dto.js';

@Injectable()
export class DeptService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.dept.findMany({
      where: { isDel: 0 },
      orderBy: [{ sortOrder: 'asc' }, { deptId: 'asc' }],
    });
    return rows.map((row) => toDto(DeptResponseDto, row));
  }

  async findOne(deptId: bigint) {
    const row = await this.prisma.dept.findFirst({ where: { deptId, isDel: 0 } });
    if (row === null) throw BusinessException.notFound('部门不存在');
    return toDto(DeptResponseDto, row)!;
  }

  async create(dto: DeptDto) {
    const parentId = dto.parentId ? BigInt(dto.parentId) : null;
    if (parentId !== null) await this.assertActive(parentId);
    const row = await this.prisma.dept.create({
      data: { deptName: dto.deptName, parentId, sortOrder: dto.sortOrder ?? 0, status: dto.status ?? 1 },
    });
    return toDto(DeptResponseDto, row)!;
  }

  async update(deptId: bigint, dto: Partial<DeptDto>) {
    const current = await this.prisma.dept.findFirst({ where: { deptId, isDel: 0 } });
    if (current === null) throw BusinessException.notFound('部门不存在');
    const data: { deptName?: string; parentId?: bigint | null; sortOrder?: number; status?: number } = {};
    if (dto.deptName !== undefined) data.deptName = dto.deptName;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.parentId !== undefined) {
      const parentId = dto.parentId === null ? null : BigInt(dto.parentId);
      if (parentId !== null) {
        if (parentId === deptId) throw BusinessException.badRequest('部门不能设置自身为上级');
        await this.assertActive(parentId);
        if (await this.hasDescendant(parentId, deptId))
          throw BusinessException.badRequest('不能将部门移动到自己的下级');
      }
      data.parentId = parentId;
    }
    return toDto(DeptResponseDto, await this.prisma.dept.update({ where: { deptId }, data }))!;
  }

  async remove(deptId: bigint) {
    const current = await this.prisma.dept.findFirst({ where: { deptId, isDel: 0 } });
    if (current === null) throw BusinessException.notFound('部门不存在');
    const [children, users] = await Promise.all([
      this.prisma.dept.count({ where: { parentId: deptId } }),
      this.prisma.user.count({ where: { deptId } }),
    ]);
    if (children || users) throw BusinessException.conflict('部门仍有子部门或用户，不能删除');
    await this.prisma.dept.update({ where: { deptId }, data: { isDel: 1 } });
  }

  private async assertActive(deptId: bigint) {
    const dept = await this.prisma.dept.findFirst({ where: { deptId, status: 1, isDel: 0 } });
    if (dept === null) throw BusinessException.badRequest('上级部门不存在、已停用或已删除');
  }

  private async hasDescendant(candidate: bigint, ancestor: bigint): Promise<boolean> {
    const children = await this.prisma.dept.findMany({
      where: { parentId: ancestor, isDel: 0 },
      select: { deptId: true },
    });
    for (const child of children) {
      if (child.deptId === candidate || (await this.hasDescendant(candidate, child.deptId))) return true;
    }
    return false;
  }
}
