import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service.js';
import { PageQueryDto } from './dto/page-query.dto.js';
import { toUserDto } from './dto/user.dto.js';
import type { UserPageDto } from './dto/user-page.dto.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** 连通性检查，返回固定欢迎语 */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * 用户列表（分页）
   *
   * @remarks 分页参数由 `normalizePage()` 归一化：非法值回落到默认值，`pageSize` 上限 200。
   * 入参结构见 `PageQueryDto`，出参结构由 `UserPageDto` 描述——接口契约只有这一处定义。
   *
   * 注意：返回类型写的是**业务数据本身**。运行期外层还会被 `@app/core` 的
   * `ResponseInterceptor` 包成 `{ code, message, data }`，但 Swagger 的 200 模型
   * 只反映 `data` 的内容——这是当前已知的文档缺口，不是笔误。
   */
  @Get('list')
  async list(@Query() query: PageQueryDto): Promise<UserPageDto> {
    const result = await this.appService.list(query);

    return { ...result, list: result.list.map(toUserDto) };
  }
}
