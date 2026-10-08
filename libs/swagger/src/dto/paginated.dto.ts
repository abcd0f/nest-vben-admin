import type { PageResult } from '@app/database';
import type { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 分页元信息（不含数据）。
 *
 * 与 `@app/database` 的 `PageResult<T>` 中除 `list` 外的字段一一对应。
 */
export class PageMetaDto {
  @ApiProperty({ description: '总条数', example: 128 })
  total!: number;

  @ApiProperty({ description: '当前页码', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总页数', example: 7 })
  totalPages!: number;
}

/**
 * 泛型结果缓存。
 *
 * 必须缓存：`PaginatedDto(UserDto)` 每次调用都会 `class` 出一个新类型，
 * 而 @nestjs/swagger 是按**类名**注册 schema 的——同一模型用在不同接口上会得到
 * 同名但不同引用的两个类，swagger 会报 "Duplicate DTO detected" 警告
 * （下个大版本直接抛错）。缓存后同名即同类。
 */
const PAGINATED_CACHE = new WeakMap<Type<unknown>, Type<unknown>>();

/**
 * 由实体 DTO 派生出「分页响应 DTO」。
 *
 * 这是把 `PageResult<T>` 这种泛型结构暴露给 OpenAPI 的标准做法——
 * OpenAPI 3 本身没有泛型，只能为每个具体类型生成一个具名 schema
 * （`PaginatedUser`、`PaginatedRole`……），并用 `$ref` 引用。
 *
 * 直接用 `@ApiPaginatedResponse(UserDto)` 更省事（见 ../decorators）。
 */
export function PaginatedDto<T>(model: Type<T>): Type<PageResult<T>> {
  const cached = PAGINATED_CACHE.get(model);
  if (cached) {
    return cached as Type<PageResult<T>>;
  }

  // 动态类只能叫 Paginated，但 @nestjs/swagger 是按**类名**注册 schema 的，
  // 所以把类名改成 `Paginated<模型名>`——schema 名、$ref、前端生成的类型名三处一次对齐。
  class Paginated extends PageMetaDto {
    @ApiProperty({ type: () => [model], description: '当前页数据' })
    list!: T[];
  }

  Object.defineProperty(Paginated, 'name', { value: `Paginated${model.name}` });

  PAGINATED_CACHE.set(model, Paginated);
  return Paginated as Type<PageResult<T>>;
}
