import { Exclude, Expose, Transform } from 'class-transformer';

/**
 * 岗位出参 DTO。
 *
 * 存在的意义是**把接口契约和数据库模型解耦**：`Post`（Prisma 模型）带 `isDel`，
 * 直接当响应类型会把软删除标记、以及将来新增的内部列一并暴露给前端。
 *
 * 因此对外响应统一经 `toDto(PostResponseDto, row)` 转换，不让 `Post` 穿过
 * controller 边界。
 *
 * 白名单而非黑名单：类上 `@Exclude()` + 每个字段 `@Expose()`，配合
 * `toDto()` 的 `excludeExtraneousValues: true`，语义是 deny-by-default。
 * 漏标 `@Expose()` 是「字段没返回」，一眼可见；漏标 `@Exclude()` 是
 * 「内部字段泄漏」，没人会发现。
 */
@Exclude()
export class PostResponseDto {
  /**
   * 岗位 ID
   * @example 1
   */
  @Expose()
  @Transform(({ value }) => value.toString())
  postId!: string;

  /**
   * 岗位编码
   * @example TECH_LEAD
   */
  @Expose()
  postCode!: string;

  /**
   * 岗位名称
   * @example 技术负责人
   */
  @Expose()
  postName!: string;

  /**
   * 同级排序号，越小越靠前
   * @example 0
   */
  @Expose()
  sortOrder!: number;

  /**
   * 岗位状态：1 正常，0 停用
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
