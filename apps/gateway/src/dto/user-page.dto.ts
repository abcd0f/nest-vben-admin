import type { PageResult } from '@app/database';
import { UserDto } from './user.dto.js';

/**
 * 用户分页响应。
 *
 * 为什么要有这个类，而不是直接用 `PageResult<UserDto>`：
 * OpenAPI 3 没有泛型，插件也无法把泛型接口反射成 schema。把方法的返回类型
 * 声明成这个具体类，插件就会自动生成对应的 200 响应模型——
 * 不需要在 controller 上写 `@ApiOkResponse({ type: ... })`。
 *
 * `implements PageResult<UserDto>` 保证字段与业务层契约一致：谁改了 `PageResult`，
 * 这里编译期就报错，文档不会悄悄落后于代码。
 */
export class UserPageDto implements PageResult<UserDto> {
  /** 当前页数据 */
  list!: UserDto[];

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
