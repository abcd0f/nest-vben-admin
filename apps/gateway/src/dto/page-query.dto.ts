import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type PageQuery } from '@app/database';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 分页入参。
 *
 * `implements PageQuery` 是关键：DTO 与业务层用的分页契约**共用同一个类型**，
 * 谁改了字段名，这里编译期就会报错。默认值/上限也直接取自 `@app/database` 的常量，
 * 不复制一份数字，避免「文档写 200、代码封顶 100」这种漂移。
 *
 * 这里的 class-validator 装饰器是**给文档用的**：Swagger 插件会把
 * `@Min` / `@Max` / `@IsInt` 翻译成 schema 的 minimum / maximum / type。
 * 本应用目前没有挂全局 ValidationPipe，所以运行期不校验——
 * 非法值仍由 `normalizePage()` 兜底（回落默认值、pageSize 截断到上限）。
 *
 * 注意一个插件的限制：它只解析**字面量**参数，`@Max(MAX_PAGE_SIZE)` 这种
 * 引用常量写法的 maximum 不会进 schema（`@Min(1)` 这种字面量才会）。
 * 这里刻意不为文档把 200 抄成字面量——单一事实来源比多一个 machine-readable
 * 上限更重要，上限写在描述里，运行期由 normalizePage() 保证。
 *
 * 用法：
 *   @Get('list')
 *   list(@Query() query: PageQueryDto) {}
 */
export class PageQueryDto implements PageQuery {
  /**
   * 页码，从 1 开始；非法值回落到默认值
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  /**
   * 每页条数，上限 200（超出按上限截断）
   * @example 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = DEFAULT_PAGE_SIZE;
}
