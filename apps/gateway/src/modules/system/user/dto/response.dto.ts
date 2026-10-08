import type { PageResult, User } from '@app/database';
import { Exclude, Expose, Transform, Type, plainToInstance } from 'class-transformer';

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
 * `plainToInstance` 的转换选项。
 *
 * 收敛成模块私有常量而不是在每个调用点手写：调用方无从绕过，
 * 也就不会出现「某个接口忘了加 `excludeExtraneousValues` 导致 password 泄漏」。
 */
const RESPONSE_TRANSFORM_OPTIONS = { excludeExtraneousValues: true } as const;

/**
 * 用户出参 DTO。
 *
 * 存在的意义不是「多写一层」，而是**把接口契约和数据库模型解耦**：
 * - `User`（Prisma 模型）带 `password` / `deletedAt`，直接当响应类型会把哈希
 *   写进接口文档，前端也会拿到不该拿的字段；
 * - 数据库加列不该自动改接口——改这里是显式动作。
 *
 * 因此对外响应统一走 `UserResponseDto.from()`，不让 `User` 穿过 controller 边界。
 *
 * ## 为什么是白名单而不是黑名单
 *
 * 类上 `@Exclude()` + 每个字段 `@Expose()`，配合 `excludeExtraneousValues: true`，
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
  id!: string;

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
  nickname!: null | string;

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

  /**
   * Prisma `User` → 出参 DTO。
   *
   * 走 `plainToInstance` 而不是手写对象字面量：新增列时不需要改这里，
   * 由「类上的装饰器」这一处决定字段是否对外可见。
   *
   * ⚠️ `@Type(() => Date)` 会在转换时读取反射元数据，要求 `reflect-metadata`
   * 已被加载。应用侧由 `@nestjs/common` 顺带加载；**spec 里必须显式
   * `import 'reflect-metadata';` 且放在第一行**，否则报
   * `TypeError: Reflect.getMetadata is not a function`。
   */
  static from(user: User): UserResponseDto {
    return plainToInstance(UserResponseDto, user, RESPONSE_TRANSFORM_OPTIONS);
  }

  /**
   * 批量映射。刻意用**一次** `plainToInstance` 处理整个数组，而不是 `list.map(from)`：
   * 后者会做 N 次元数据查找。pageSize 上限 200，差别不大，但没理由付这个成本。
   */
  static fromList(users: User[]): UserResponseDto[] {
    return plainToInstance(UserResponseDto, users, RESPONSE_TRANSFORM_OPTIONS);
  }
}

/**
 * 用户分页响应。
 *
 * 为什么要有这个具体类，而不是直接用 `PageResult<UserResponseDto>`：
 * OpenAPI 3 没有泛型，泛型接口也无法被反射成 schema。把方法的返回类型声明成
 * 这个具体类，文档才能生成对应的 200 响应模型——不需要在 controller 上写任何 `@Api*`。
 *
 * `implements PageResult<UserResponseDto>` 保证字段与 `@app/database` 的契约一致：
 * 谁改了 `PageResult`，这里编译期就报错，文档不会悄悄落后于代码。
 */
export class UserPageDto implements PageResult<UserResponseDto> {
  /** 当前页数据 */
  list!: UserResponseDto[];

  /**
   * 总条数
   * @example 128
   */
  total!: number;

  /**
   * 当前页码
   * @example 1
   */
  page!: number;

  /**
   * 每页条数
   * @example 20
   */
  pageSize!: number;

  /**
   * 总页数
   * @example 7
   */
  totalPages!: number;
}
