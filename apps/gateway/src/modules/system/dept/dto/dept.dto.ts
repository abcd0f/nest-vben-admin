import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

/**
 * 部门新增 / 更新入参。
 *
 * 同一个类被 `POST /system/dept` 与 `PATCH /system/dept/:deptId` 共用，
 * controller 在更新路径上声明成 `Partial<DeptDto>`——PATCH 语义是
 * 「只改传了的字段」。
 *
 * 装饰器同时承担两件事（与 `CreateUserDto` 的约定一致）：
 * - 运行期校验：`AppValidationPipe` 由 `CoreModule` 全局挂载，非法输入在进入
 *   controller 前被拒，返回 422 + 字段级 `details`；
 * - 文档生成：注释正文 → `description`，`@example` → `example`，
 *   业务代码里不出现任何 `@Api*`。
 *
 * 长度上限对齐 `prisma/models/dept.prisma` 的列定义（`@db.VarChar(64)`），
 * 校验层拦不住超长值就会让数据库抛 `value too long for type character varying(64)`
 * ——那是个 500，本该是 400。
 */
export class DeptDto {
  /**
   * 部门名称
   * @example 研发部
   */
  @IsString()
  @Length(1, 64)
  deptName!: string;

  /**
   * 上级部门 ID。省略 = 保持不变（更新时）或建为顶级部门（新增时）；
   * 传 `null` = 建为顶级部门，或把已有部门移到根节点
   *
   * 必须是正整数十进制字符串：主键是 PostgreSQL BIGINT，经 JS `number`
   * 会丢精度。`DeptService` 会校验上级部门存在、启用且未删除，并拒绝
   * 把部门挂到自己或自己的后代下（防止形成环）。
   * @example 1
   */
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

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
   * 部门状态：1 正常，0 停用。缺省 1
   *
   * 停用不会级联停用子部门，但停用的部门不能再被指定为上级部门
   * （`DeptService.assertActive()` 会拒绝），也不能再分配给用户。
   * @example 1
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}
