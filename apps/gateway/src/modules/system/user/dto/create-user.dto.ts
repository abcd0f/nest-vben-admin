import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/**
 * 新增用户入参。
 *
 * 这里的装饰器**同时承担两件事**，不是二选一：
 * - 运行期校验：`@app/core` 的 `AppValidationPipe` 已由 `CoreModule` 全局挂载，
 *   非法输入在进入 controller 之前就会被拒，返回 422 + 字段级 `details`；
 * - 文档生成：注释正文与类型会进 OpenAPI，不需要任何 `@ApiProperty`。
 *
 * 长度上限不是随手写的，全部对齐 `prisma/schema.prisma` 的列定义
 * （`@db.VarChar(64)` 等）。校验层不拦住超长字符串，就会让数据库抛
 * `value too long for type character varying(64)`——那是个 500，而这里本该是 400。
 */
export class CreateUserDto {
  /**
   * 用户名，3~64 位，仅允许字母、数字、下划线、连字符
   * @example admin
   */
  @IsString()
  @Length(3, 64, { message: '用户名长度必须在 3~64 位之间' })
  @Matches(/^[\w-]+$/, { message: '用户名只能包含字母、数字、下划线和连字符' })
  username!: string;

  /**
   * 登录密码，6~64 位
   * @example P@ssw0rd
   */
  @IsString()
  @Length(6, 64, { message: '密码长度必须在 6~64 位之间' })
  password!: string;

  /**
   * 邮箱，全局唯一
   * @example admin@example.com
   */
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(128, { message: '邮箱长度不能超过 128 位' })
  email?: string;

  /**
   * 昵称
   * @example 管理员
   */
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: '昵称长度不能超过 64 位' })
  nickname?: string;
}
