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
   */
  @Get('list')
  async list(@Query() query: PageQueryDto): Promise<UserPageDto> {
    const result = await this.appService.list(query);

    return { ...result, list: result.list.map(toUserDto) };
  }
}
