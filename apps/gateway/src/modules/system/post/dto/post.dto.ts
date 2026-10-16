import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/**
 * 岗位新增 / 更新入参。
 *
 * 同一个类被 `POST /system/post` 与 `PATCH /system/post/:id` 共用，controller
 * 在更新路径上声明成 `Partial<PostDto>`——PATCH 语义是「只改传了的字段」。
 *
 * 装饰器同时承担两件事（与 `CreateUserDto` 的约定一致）：
 * - 运行期校验：`AppValidationPipe` 由 `CoreModule` 全局挂载，非法输入在进入
 *   controller 前被拒，返回 422 + 字段级 `details`；
 * - 文档生成：注释正文 → `description`，`@example` → `example`，
 *   业务代码里不出现任何 `@Api*`。
 *
 * 长度上限对齐 `prisma/models/post.prisma` 的列定义（`@db.VarChar(64)`）。
 *
 * 岗位只用于资料展示与用户筛选，**不授予任何角色或权限**——权限只经
 * `sys_user_role → sys_role_menu → sys_menu` 判定。
 */
export class PostDto {
  /**
   * 岗位编码，全局唯一。含软删除记录在内全表唯一，被软删除的编码不会释放，
   * 复用同名编码会返回 409
   * @example TECH_LEAD
   */
  @IsString()
  @Length(1, 64)
  postCode!: string;

  /**
   * 岗位名称
   * @example 技术负责人
   */
  @IsString()
  @Length(1, 64)
  postName!: string;

  /**
   * 同级排序号，越小越靠前。缺省 0；上限对齐 `sort_order` 的 `@db.SmallInt`
   * @example 0
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  sortOrder?: number;

  /**
   * 岗位状态：1 正常，0 停用。缺省 1
   *
   * 停用不解除已有的用户-岗位关联，但停用的岗位不会再被 `replaceUserPosts()`
   * 接受（`assertActivePosts()` 会拒绝）。
   * @example 1
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}
