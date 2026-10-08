import type { PageQuery, PageResult, User } from '@app/database';
import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * 用户列表（分页）。
   *
   * GET /list?page=1&pageSize=20
   *
   * page / pageSize 由 @app/database 的 normalizePage() 归一化：
   * 非法值回落到默认值，pageSize 上限 200。
   */
  @Get('list')
  list(@Query() query: PageQuery): Promise<PageResult<User>> {
    return this.appService.list(query);
  }
}
