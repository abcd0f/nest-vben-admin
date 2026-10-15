import { Exclude, Expose, Transform } from 'class-transformer';
import { MenuType } from './menu.dto.js';

/**
 * 菜单出参 DTO。
 *
 * 存在的意义是**把接口契约和数据库模型解耦**：`Menu`（Prisma 模型）带 `isDel`，
 * 直接当响应类型会把软删除标记、以及将来新增的内部列一并暴露给前端。
 *
 * 因此对外响应统一经 `toDto(MenuResponseDto, row)` 转换。
 *
 * 白名单而非黑名单：类上 `@Exclude()` + 每个字段 `@Expose()`，配合
 * `toDto()` 的 `excludeExtraneousValues: true`，语义是 deny-by-default。
 *
 * 注意：本接口返回的是**全量扁平列表**（按 `sortOrder`、`menuId` 升序），
 * 不是树；前端按 `parentId` 自行组装。`ACTION` 节点同样在列表里——
 * 它们代表可授权的操作权限点，前端靠它渲染按钮级权限。
 */
@Exclude()
export class MenuResponseDto {
  /**
   * 菜单 ID
   * @example 1
   */
  @Expose()
  @Transform(({ value }) => value.toString())
  menuId!: string;

  /**
   * 上级菜单 ID，顶级节点为 `null`
   * @example 1
   */
  @Expose()
  @Transform(({ value }) => value?.toString() ?? null)
  parentId!: string | null;

  /**
   * 菜单类型：`DIRECTORY` 目录 / `MENU` 页面 / `ACTION` 操作权限点
   * @example MENU
   */
  @Expose()
  menuType!: MenuType;

  /**
   * 菜单名称
   * @example 用户管理
   */
  @Expose()
  menuName!: string;

  /**
   * 前端路由路径，`ACTION` 节点为 `null`
   * @example /system/user
   */
  @Expose()
  routePath!: string | null;

  /**
   * 前端组件路径，可为 `null`
   * @example system/user/index
   */
  @Expose()
  component!: string | null;

  /**
   * 权限标识码。仅 `ACTION` 节点有值，其余为 `null`
   * @example system:user:list
   */
  @Expose()
  permissionCode!: string | null;

  /**
   * 同级排序号，越小越靠前
   * @example 0
   */
  @Expose()
  sortOrder!: number;

  /**
   * 菜单状态：1 正常，0 停用
   * @example 1
   */
  @Expose()
  status!: number;

  /** 创建时间 */
  @Expose()
  createdTime!: Date;

  /** 更新时间 */
  @Expose()
  updatedTime!: Date;
}
