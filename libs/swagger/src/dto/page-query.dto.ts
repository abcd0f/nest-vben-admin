import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type PageQuery } from '@app/database';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 分页入参。
 *
 * `implements PageQuery` 是关键：DTO 与业务层用的分页契约**共用同一个类型**，
 * 谁改了字段名，这里编译期就会报错。默认值/上限也直接取自 `@app/database` 的常量，
 * 不复制一份数字，避免「文档写 200、代码封顶 100」这种漂移。
 *
 * 用法：
 *   @Get('list')
 *   list(@Query() query: PageQueryDto) {}
 */
export class PageQueryDto implements PageQuery {
  @ApiPropertyOptional({
    description: '页码，从 1 开始；非法值回落到默认值',
    minimum: 1,
    default: DEFAULT_PAGE,
    example: DEFAULT_PAGE,
  })
  page?: number;

  @ApiPropertyOptional({
    description: `每页条数，上限 ${MAX_PAGE_SIZE}（超出按上限截断）`,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    example: DEFAULT_PAGE_SIZE,
  })
  pageSize?: number;
}
