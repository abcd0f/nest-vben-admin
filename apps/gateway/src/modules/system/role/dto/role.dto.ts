import { DataScope } from '@app/database/generated/prisma/client.js';
import { Exclude, Expose, Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export { DataScope };

/**
 * 角色新增入参。
 *
 * 装饰器同时承担两件事（与 `CreateUserDto` 的约定一致）：
 * - 运行期校验：`AppValidationPipe` 由 `CoreModule` 全局挂载，非法输入在进入
 *   controller 前被拒，返回 422 + 字段级 `details`；
 * - 文档生成：注释正文 → `description`，`@example` → `example`，
 *   业务代码里不出现任何 `@Api*`。
 *
 * 长度上限对齐 `prisma/models/role.prisma` 的 `Role` 列定义（`@db.VarChar(64)`）。
 *
 * 本接口要求系统管理员身份（controller 上的 `@SystemAdmin()`），
 * 仅持有 `system:role:create` 权限不够。
 */
export class CreateRoleDto {
  /**
   * 角色编码，全局唯一，程序内鉴权用。含软删除记录在内全表唯一，
   * 被删除的编码不会释放
   * @example system_admin
   */
  @IsString()
  @Length(1, 64)
  roleCode!: string;

  /**
   * 角色名称
   * @example 系统管理员
   */
  @IsString()
  @Length(1, 64)
  roleName!: string;

  /**
   * 数据权限范围。缺省 `SELF`（仅本人），即最小权限
   *
   * - `ALL` 全部数据
   * - `DEPT_AND_CHILDREN` 本部门及有效后代
   * - `DEPT` 本部门
   * - `CUSTOM` 由 `sys_role_dept` 指定的部门
   * - `SELF` 仅本人（要求资源有归属字段，不能用 `dept_id` 顶替）
   * @example SELF
   */
  @IsOptional()
  @IsEnum(DataScope)
  dataScope?: DataScope;

  /**
   * 角色状态：1 正常，0 停用。缺省 1
   *
   * 停用的角色不参与鉴权（权限与数据范围查询都带 `status: 1`），
   * 也不能再分配给用户。
   * @example 1
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

/**
 * 角色更新入参（PATCH 语义，字段全可选）。
 *
 * **不含 `roleCode`**：编码是鉴权数据的稳定标识，改名会影响已授权的
 * 角色菜单与 `data_scope` 语义，属于受控迁移动作而不是普通编辑字段。
 *
 * `isSystem` 也不可通过接口修改——系统内置角色只能由初始化脚本创建。
 *
 * 约束（在 service 层执行）：
 * - 目标角色必须存在且未软删除，否则 404；
 * - 系统角色的 `isSystem = true`，把它改成 `status: 0` 返回 409
 *   （`系统角色不能停用`）；
 * - `dataScope` 改成非 `CUSTOM` 时，会在**同一个事务**内清空该角色旧的
 *   `sys_role_dept` 行，避免留下「看起来有自定义范围但实际不生效」的脏数据。
 */
export class UpdateRoleDto {
  /**
   * 角色名称
   * @example 系统管理员
   */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  roleName?: string;

  /**
   * 数据权限范围。改成非 `CUSTOM` 时事务内清空旧的部门关联
   * @example CUSTOM
   */
  @IsOptional()
  @IsEnum(DataScope)
  dataScope?: DataScope;

  /**
   * 角色状态：1 正常，0 停用。系统角色不接受 0（返回 409）
   * @example 1
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

/**
 * 「全量替换关联 ID 列表」的公共基类。
 *
 * 被四类批量替换接口共用：用户岗位、用户角色、角色部门、角色菜单。
 * 语义统一是 **PUT + 全量替换**，不是「增量添加」：
 * `RoleService` 在事务里先 `deleteMany` 再 `createMany`，请求里没有的
 * 关联一律解除。传空数组 = 清空全部关联。
 *
 * 为什么要抽出基类：四个接口的入参形状完全相同（一个 `ids` 数组），
 * 校验规则也相同。`ReplaceIdsDto extends IdListDto {}` 而不是直接
 * `export class ReplaceIdsDto` 再写一遍装饰器，是为了让「四个接口共用同一份
 * 校验」这件事在代码里显式成立——将来加个元素个数上限只需改一处。
 *
 * 注意 `IdListDto` 本身**没有 `@Api*` 也不导出**：它只作为基类存在，
 * 文档里出现的是 `ReplaceIdsDto`。
 */
class IdListDto {
  /**
   * 目标 ID 列表。全部替换语义：不在列表里的关联会被解除
   * @example ["2", "3"]
   */
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[1-9]\d*$/, { each: true })
  ids!: string[];
}

/**
 * 角色出参 DTO。
 *
 * 存在的意义是**把接口契约和数据库模型解耦**：`Role`（Prisma 模型）带 `isDel`，
 * 直接当响应类型会把软删除标记、以及将来新增的内部列一并暴露给前端。
 *
 * 因此对外响应统一经 `toDto(RoleResponseDto, row)` 转换。
 *
 * 白名单而非黑名单：类上 `@Exclude()` + 每个字段 `@Expose()`，配合
 * `toDto()` 的 `excludeExtraneousValues: true`，语义是 deny-by-default。
 * 漏标 `@Expose()` 是「字段没返回」，一眼可见；漏标 `@Exclude()` 是
 * 「内部字段泄漏」，没人会发现。
 */
@Exclude()
export class RoleResponseDto {
  /**
   * 角色 ID
   * @example 1
   */
  @Expose() @Transform(({ value }) => value.toString()) roleId!: string;

  /**
   * 角色编码
   * @example system_admin
   */
  @Expose() roleCode!: string;

  /**
   * 角色名称
   * @example 系统管理员
   */
  @Expose() roleName!: string;

  /**
   * 数据权限范围
   * @example SELF
   */
  @Expose() dataScope!: DataScope;

  /**
   * 角色状态：1 正常，0 停用
   * @example 1
   */
  @Expose() status!: number;

  /**
   * 是否系统内置角色。内置角色不能停用、不能删除；
   * 用户还必须保留至少一个有效系统角色
   * @example false
   */
  @Expose() isSystem!: boolean;

  /** 创建时间 */
  @Expose() createdTime!: Date;

  /** 更新时间 */
  @Expose() updatedTime!: Date;
}

/**
 * 批量替换关联 ID 的请求体。
 *
 * 用于四类接口，全部是 **PUT + 全量替换** 语义：
 *
 * | 接口 | 被替换的关联表 |
 * | --- | --- |
 * | `PUT /system/user/:userId/posts` | `sys_user_post` |
 * | `PUT /system/user/:userId/roles` | `sys_user_role` |
 * | `PUT /system/role/:roleId/depts` | `sys_role_dept` |
 * | `PUT /system/role/:roleId/menus` | `sys_role_menu` |
 *
 * 各接口在写库前的校验不同（目标必须存在、启用、未软删除；
 * 部门范围要求角色是 `CUSTOM`；角色菜单要求菜单是 `ACTION` 之外的任意启用节点等），
 * 但**任一个目标不合法就整体拒绝**，不会留下部分更新。
 *
 * 字段约束见 `IdListDto.ids`。
 */
export class ReplaceIdsDto extends IdListDto {}
