import { toDto } from '@app/common';
import { BusinessException } from '@app/core';
import { PrismaService } from '@app/database';
import { Injectable } from '@nestjs/common';
import { Exclude, Expose, Transform } from 'class-transformer';
import { PostDto } from './post.dto.js';

@Exclude()
export class PostResponseDto {
  @Expose() @Transform(({ value }) => value.toString()) postId!: string;
  @Expose() postCode!: string;
  @Expose() postName!: string;
  @Expose() sortOrder!: number;
  @Expose() status!: number;
  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;
}
@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll() {
    return (
      await this.prisma.post.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { postId: 'asc' }],
      })
    ).map((x) => toDto(PostResponseDto, x));
  }

  async findOne(id: bigint) {
    const x = await this.prisma.post.findFirst({ where: { postId: id, deletedAt: null } });
    if (!x) throw BusinessException.notFound('岗位不存在');
    return toDto(PostResponseDto, x)!;
  }

  async create(dto: PostDto) {
    const x = await this.prisma.post.create({
      data: { ...dto, sortOrder: dto.sortOrder ?? 0, status: dto.status ?? 1 },
    });
    return toDto(PostResponseDto, x)!;
  }

  async update(id: bigint, dto: Partial<PostDto>) {
    const x = await this.prisma.post.findFirst({ where: { postId: id, deletedAt: null } });
    if (!x) throw BusinessException.notFound('岗位不存在');
    return toDto(PostResponseDto, await this.prisma.post.update({ where: { postId: id }, data: dto }))!;
  }

  async remove(id: bigint) {
    const x = await this.prisma.post.findFirst({ where: { postId: id, deletedAt: null } });
    if (!x) throw BusinessException.notFound('岗位不存在');
    await this.prisma.post.update({ where: { postId: id }, data: { deletedAt: new Date() } });
  }
}
