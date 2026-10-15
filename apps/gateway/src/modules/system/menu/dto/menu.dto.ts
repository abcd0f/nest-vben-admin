import { MenuType } from '@app/database/generated/prisma/client.js';
import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export { MenuType };

/**
 * 菜单新增入参。
 *
 * 与 `UpdateMenuDto` 分成两个类而不是用 `PartialType`：新增时 `menuType` /
 * `menuName` 必填，更新时全可选，且 `partial` 化会把「必填」这个契约信息抹掉
 * ——文档上就看不出来新增时到底哪些字段不能省。
 *
 * 装饰器同时承担两件事（与 `CreateUserDto` 的约定一致）：
 * - 运行期校验：`AppValidationPipe` 由 `CoreModule` 全局挂载，非法输入在进入
 *   controller 前被拒，返回 422 + 字段级 `details`；
 * - 文档生成：注释正文 → `description`，`@example` → `example`，
 *   业务代码里不出现任何 `@Api*`。
 *
 * 长度上限对齐 `prisma/models/role.prisma` 的 `Menu` 列定义
 * （`@db.VarChar(64/255/128)`）。
 *
 * ## 类型与父子关系约束（在 service 层执行，DTO 拦不住）
 *
 * `MenuService.prepareData()` 会在写库前校验，违反时返回 400：
 *
 * | 自身类型 | 允许的父类型 | 允许的子类型 |
 * | --- | --- | --- |
 * | `DIRECTORY` | 无父（`parentId = null`） | `MENU` |
 * | `MENU` | `DIRECTORY` | `ACTION` |
 * | `ACTION` | `MENU` | 无子节点 |
 *
 * 另外：
 * - `permissionCode` 与 `menuType` 双向绑定——`ACTION` 必须填，`DIRECTORY` /
 *   `MENU` 必须不填，否则 400；
 * - `parentId` 不得指向自身或自己的后代（防环）；
 * - 上级菜单必须存在、启用且未软删除。
 */
export class MenuDto {
  /**
   * 上级菜单 ID。省略或传 `null` = 建为顶级节点
   *
   * 必须是正整数十进制字符串。仅 `DIRECTORY` 可以没有父节点，
   * `MENU` / `ACTION` 必须挂到合法父节点下（见类注释的父子类型表）。
   * @example 1
   */
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

  /**
   * 菜单类型：`DIRECTORY` 目录 / `MENU` 页面 / `ACTION` 按钮或接口权限点。
   * 枚举取自 Prisma 生成的 `MenuType`，取值不可扩展
   * @example MENU
   */
  @IsEnum(MenuType)
  menuType!: MenuType;

  /**
   * 菜单名称
   * @example 用户管理
   */
  @IsString()
  @Length(1, 64)
  menuName!: string;

  /**
   * 前端路由路径，可为空（`ACTION` 无路由）。对齐 `route_path` 的
   * `@db.VarChar(255)`
   * @example /system/user
   */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  routePath?: string | null;

  /**
   * 前端组件路径，可为空。对齐 `component` 的 `@db.VarChar(255)`
   * @example system/user/index
   */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  component?: string | null;

  /**
   * 权限标识码，全局唯一，如 `system:user:list`。对齐 `permission_code` 的
   * `@db.VarChar(128)`
   *
   * 只有 `ACTION` 类型可以填，且必填——接口鉴权实际读的就是这一列
   * （`sys_user_role → sys_role_menu → sys_menu.permission_code`）。
   * `DIRECTORY` / `MENU` 填了会被拒绝：目录和页面只负责路由展示，
   * 不参与 API 授权。
   *
   * 唯一性含软删除记录在内，被删除的编码不会释放。
   * @example system:user:list
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  permissionCode?: string | null;

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
   * 菜单状态：1 正常，0 停用。缺省 1
   *
   * 停用的菜单不参与鉴权（`PermissionService` 的查询都带 `status: 1`），
   * 也不再是合法的上级节点。
   * @example 1
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

/**
 * 菜单更新入参（PATCH 语义，字段全可选）。
 *
 * 没有复用 `PartialType(MenuDto)` 的原因：那会产生一个类型上「全可选」、
 * 但实际上与新增共用同一套语义的类，`menuType` 的必填性反而在文档里表达
 * 不清。手写一份让「更新时每个字段都可选」这个事实显式可见。
 *
 * 更新路径上比新增多一条约束：改 `menuType` 时，所有已有子节点的类型必须
 * 仍满足父子规则，否则返回 409（`菜单类型变更会破坏子节点关系`）。
 *
 * 字段级约束与 `MenuDto` 一致，见那边的说明。
 */
export class UpdateMenuDto {
  /**
   * 上级菜单 ID。传 `null` = 移到根节点；省略 = 不变。
   * 不得指向自身或自己的后代
   * @example 1
   */
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

  /**
   * 菜单类型。变更时会校验已有子节点类型，破坏关系则返回 409
   * @example MENU
   */
  @IsOptional() @IsEnum(MenuType) menuType?: MenuType;

  /**
   * 菜单名称
   * @example 用户管理
   */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  menuName?: string;

  /**
   * 前端路由路径，传 `null` 表示清空
   * @example /system/user
   */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  routePath?: string | null;

  /**
   * 前端组件路径，传 `null` 表示清空
   * @example system/user/index
   */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  component?: string | null;

  /**
   * 权限标识码，全局唯一。仅 `ACTION` 类型可填且必填，
   * 传 `null` 表示清空（仅对非 `ACTION` 类型合法）
   * @example system:user:list
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  permissionCode?: string | null;

  /**
   * 同级排序号，越小越靠前
   * @example 0
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  sortOrder?: number;

  /**
   * 菜单状态：1 正常，0 停用
   * @example 1
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}
