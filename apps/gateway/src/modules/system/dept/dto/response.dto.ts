import { Exclude, Expose, Transform } from 'class-transformer';

/**
 * 部门出参 DTO。
 *
 * 存在的意义是**把接口契约和数据库模型解耦**：`Dept`（Prisma 模型）带 `isDel`，
 * 直接当响应类型会把软删除标记、以及将来新增的内部列一并暴露给前端。
 *
 * 因此对外响应统一经 `toDto(DeptResponseDto, row)` 转换，不让 `Dept` 穿过
 * controller 边界。
 *
 * 白名单而非黑名单：类上 `@Exclude()` + 每个字段 `@Expose()`，配合
 * `toDto()` 的 `excludeExtraneousValues: true`，语义是 deny-by-default。
 * 两种写法的失败模式不对称——漏标 `@Expose()` 是「字段没返回」，一眼可见；
 * 漏标 `@Exclude()` 是「内部字段泄漏」，没人会发现。
 *
 * 注意：本接口返回的是**全量扁平列表**，不是树。前端按 `parentId` 自行组装，
 * 这样「按部门筛选用户」等场景不需要再递归展开。
 */
@Exclude()
export class DeptResponseDto {
  /**
   * 部门 ID
   * @example 1
   */
  @Expose()
  @Transform(({ value }) => value.toString())
  deptId!: string;

  /**
   * 上级部门 ID，顶级部门为 `null`
   * @example 1
   */
  @Expose()
  @Transform(({ value }) => value?.toString() ?? null)
  parentId!: null | string;

  /**
   * 部门名称
   * @example 研发部
   */
  @Expose()
  deptName!: string;

  /**
   * 同级排序号，越小越靠前
   * @example 0
   */
  @Expose()
  sortOrder!: number;

  /**
   * 部门状态：1 正常，0 停用
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
