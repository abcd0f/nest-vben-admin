import type { User } from '@app/database';
import { Expose } from 'class-transformer';

/**
 * 用户状态。
 *
 * 为什么定义成 TS 枚举，而不是在注释里写 `@enum [0, 1]`：
 * Swagger 插件只识别注释里的正文（→ description）和 `@example`，
 * `@enum` / `@format` 这类标签会被当成正文的一部分塞进描述里。
 * 枚举只能靠**类型**表达——写成枚举类型，插件才会生成 `enum` 字段。
 */
export enum UserStatus {
  /** 停用 */
  DISABLED = 0,
  /** 正常 */
  ENABLED = 1,
}

/**
 * 用户出参 DTO。
 *
 * 存在的意义不是「多写一层」，而是**把接口契约和数据库模型解耦**：
 * - `User`（Prisma 模型）带 `password` / `deletedAt`，直接当响应类型会把哈希写进 OpenAPI 文档，
 *   前端也会拿到不该拿的字段；
 * - 数据库加字段不该自动改接口——改这里是显式动作。
 *
 * 因此对外响应统一走 `toUserDto()` 映射，不要让 `User` 直接穿过 controller 边界。
 *
 * 文档全部来自本文件的注释与类型，**不需要任何 @ApiProperty**。
 */
export class UserDto {
  /** 用户 ID */
  @Expose()
  id!: string;

  /** 用户名 */
  @Expose()
  username!: string;

  /**
   * 邮箱
   * @example admin@example.com
   */
  email?: string | null;

  /**
   * 昵称
   * @example 管理员
   */
  nickname?: string | null;

  /**
   * 状态：1 正常，0 停用
   * @example 1
   */
  status!: UserStatus;

  /** 创建时间 */
  createdAt!: Date;

  /** 更新时间 */
  updatedAt!: Date;
}

/** Prisma `User` → `UserDto`。显式列字段，新增敏感列时不会自动泄漏。 */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    // 库里是 Int（SmallInt 列，见 prisma/schema.prisma），取值只有 0 / 1。
    // 这里做一次显式归一化，而不是 `as UserStatus`：类型断言只是骗过编译器，
    // 真出现脏值时接口契约会直接对外撒谎。
    status: user.status === UserStatus.DISABLED ? UserStatus.DISABLED : UserStatus.ENABLED,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
