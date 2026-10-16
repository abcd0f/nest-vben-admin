import { toDto } from '@app/common';
import { BusinessException } from '@app/core';
import { nextSnowflakeId, PrismaService } from '@app/database';
import { Injectable } from '@nestjs/common';
import { PostDto } from './dto/post.dto.js';
import { PostResponseDto } from './dto/response.dto.js';

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll() {
    return (
      await this.prisma.post.findMany({
        where: { isDel: 0 },
        orderBy: [{ sortOrder: 'asc' }, { postId: 'asc' }],
      })
    ).map((x) => toDto(PostResponseDto, x));
  }

  async findOne(id: bigint) {
    const x = await this.prisma.post.findFirst({ where: { postId: id, isDel: 0 } });
    if (!x) throw BusinessException.notFound('岗位不存在');
    return toDto(PostResponseDto, x)!;
  }

  async create(dto: PostDto) {
    const x = await this.prisma.post.create({
      data: { postId: nextSnowflakeId(), ...dto, sortOrder: dto.sortOrder ?? 0, status: dto.status ?? 1 },
    });
    return toDto(PostResponseDto, x)!;
  }

  async update(id: bigint, dto: Partial<PostDto>) {
    const x = await this.prisma.post.findFirst({ where: { postId: id, isDel: 0 } });
    if (!x) throw BusinessException.notFound('岗位不存在');
    return toDto(PostResponseDto, await this.prisma.post.update({ where: { postId: id }, data: dto }))!;
  }

  async remove(id: bigint) {
    const x = await this.prisma.post.findFirst({ where: { postId: id, isDel: 0 } });
    if (!x) throw BusinessException.notFound('岗位不存在');
    await this.prisma.post.update({ where: { postId: id }, data: { isDel: 1 } });
  }
}
