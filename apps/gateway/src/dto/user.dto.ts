import type { User } from '@app/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * 用户出参 DTO。
 *
 * 存在的意义不是「多写一层」，而是**把接口契约和数据库模型解耦**：
 * - `User`（Prisma 模型）带 `password` / `deletedAt`，直接当响应类型会把哈希写进 OpenAPI 文档，
 *   前端也会拿到不该拿的字段；
 * - 数据库加字段不该自动改接口——改这里是显式动作。
 *
 * 因此对外响应统一走 `toUserDto()` 映射，不要让 `User` 直接穿过 controller 边界。
 */
export class UserDto {
  /** 用户 ID */
  @Expose()
  id!: string;

  /** 用户名 */
  @Expose()
  username!: string;

  @ApiPropertyOptional({ description: '邮箱', nullable: true, example: 'admin@example.com' })
  /**
   * 邮箱
   * @example admin@example.com
   */
  email?: string | null;

  @ApiPropertyOptional({ description: '昵称', nullable: true, example: '管理员' })
  /**
   * 昵称
   * @example 管理员
   */
  nickname?: string | null;

  @ApiProperty({ description: '状态：1 正常，0 停用', enum: [0, 1], example: 1 })
  /**
   * 状态：1 正常，0 停用
   * @enum [0, 1]
   * @example 1
   */
  status!: number;

  @ApiProperty({ description: '创建时间', format: 'date-time' })
  /**
   * 创建时间
   * @format date-time
   */
  createdAt!: Date;

  @ApiProperty({ description: '更新时间', format: 'date-time' })
  /**
   * 更新时间
   * @format date-time
   */
  updatedAt!: Date;
}

/** Prisma `User` → `UserDto`。显式列字段，新增敏感列时不会自动泄漏。 */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
