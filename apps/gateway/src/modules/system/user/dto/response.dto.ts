import type { PageMetaDto, PageResponseDto } from '@app/common';
import { Exclude, Expose, Transform, Type } from 'class-transformer';

/**
 * 用户状态。取值严格对齐 `prisma/schema.prisma` 的 `status Int @default(1) @db.SmallInt`
 * ——该列只有 0 / 1 两个合法值。
 *
 * 为什么定义成 TS 枚举，而不是在注释里写 `@enum [0, 1]`：
 * 文档生成只识别注释正文（→ description）和 `@example`，`@enum` / `@format`
 * 这类标签会被当成正文的一部分塞进描述里。枚举只能靠**类型**表达。
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
 * - `User`（Prisma 模型）带 `password` / `deletedAt`，直接当响应类型会把密码
 *   写进接口文档，前端也会拿到不该拿的字段；
 * - 数据库加列不该自动改接口——改这里是显式动作。
 *
 * 因此对外响应统一用 `toDto()` / `toDtoList()` 转换，不让 `User` 穿过 controller 边界。
 *
 * ## 为什么是白名单而不是黑名单
 *
 * 类上 `@Exclude()` + 每个字段 `@Expose()`，配合公共转换器的 `excludeExtraneousValues: true`，
 * 语义是 **deny-by-default**。两种写法的失败模式不对称：
 * - 白名单漏标 `@Expose()` → 字段没返回，一眼可见；
 * - 黑名单漏标 `@Exclude()` → `password` 泄漏，没人会发现。
 *
 * 代价是「新增字段忘了标 `@Expose()` 会静默消失」，这个代价用字段清单用例兜住
 * （`Object.keys(dto).sort()` 全量断言），而不是靠人眼 review。
 */
@Exclude()
export class UserResponseDto {
  /** 用户 ID */
  @Expose()
  @Transform(({ value }) => value.toString())
  userId!: string;

  /** 用户名 */
  @Expose()
  username!: string;

  /**
   * 邮箱
   * @example admin@example.com
   */
  @Expose()
  email!: null | string;

  /**
   * 昵称
   * @example 管理员
   */
  @Expose()
  nickName!: null | string;

  /**
   * 状态：1 正常，0 停用
   * @example 1
   */
  @Expose()
  @Transform(({ value }) => (value === UserStatus.DISABLED ? UserStatus.DISABLED : UserStatus.ENABLED))
  status!: UserStatus;

  /** 创建时间 */
  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  /** 更新时间 */
  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}

/**
 * 用户分页响应。
 *
 * 为什么要有这个具体类，而不是直接用 `PageResponseDto<UserResponseDto>`：
 * OpenAPI 3 没有泛型，泛型接口也无法被反射成 schema。把方法的返回类型声明成
 * 这个具体类，文档才能生成对应的 200 响应模型——不需要在 controller 上写任何 `@Api*`。
 *
 * `implements PageResponseDto<UserResponseDto>` 保证字段与公共分页响应契约一致。
 */
export class UserPageDto implements PageResponseDto<UserResponseDto> {
  /** 当前页数据 */
  items!: UserResponseDto[];

  /** 分页元数据 */
  meta!: PageMetaDto;
}
