import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type PageQuery } from '@app/database';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 分页入参（通用）。
 *
 * 放在应用级 `src/dto/` 而不是某个业务模块内：分页是所有列表接口的公共契约，
 * 塞进 user 模块会让 role / menu / dict 的列表接口被迫反向依赖 user 模块。
 *
 * `implements PageQuery` 是关键：DTO 与 `@app/database` 的 `paginate()` 共用同一个类型，
 * 谁改了字段名，这里编译期就报错。默认值与上限也直接取自 `@app/database` 的常量，
 * 不复制一份数字，避免「文档写 200、代码封顶 100」这种漂移。
 *
 * ## 两层防护，职责不同（实测行为，别再按注释想当然）
 *
 * 1. **校验层（严格）**：`@Min(1)` / `@Max(MAX_PAGE_SIZE)` 这些装饰器在
 *    `AppValidationPipe`（由 `CoreModule` 全局挂载）下具备**运行期约束力**，
 *    所以 `?page=0`、`?pageSize=9999`、`?page=abc` 都会直接返回 422 + 字段级 `details`，
 *    **不会被静默截断**。显式越界的请求报错比悄悄返回 200 条更有用——
 *    否则调用方会以为自己拿到了 9999 条。
 * 2. **兜底层（宽松）**：`normalizePage()` 负责「字段缺省」与「绕过管道」的场景
 *    （非 HTTP 调用、或 `@IsOptional()` 放行的 `undefined`），给出默认值并把
 *    `pageSize` 截断到上限。
 *
 * 因此：**缺省 → 默认值；非法/越界 → 422**。
 *
 * 注意 `@Max(MAX_PAGE_SIZE)` 引用的是常量而非字面量：文档生成只解析字面量参数，
 * 这个上限不会进 schema。这里刻意不为文档把 200 抄成字面量——单一事实来源
 * 比多一个 machine-readable 上限更重要，上限写在描述里。
 */
export class PageQueryDto implements PageQuery {
  /**
   * 页码，从 1 开始；缺省为 1，小于 1 返回 422
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  /**
   * 每页条数，缺省 20，上限 200；超出上限返回 422
   * @example 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number = DEFAULT_PAGE_SIZE;
}
