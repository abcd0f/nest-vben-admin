import type { PageResult } from '@app/database';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { toUserDto, UserDto } from './dto/user.dto.js';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '健康检查', description: '返回固定问候语，用于探活。' })
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
   *
   * 分页入参/出参的文档全部来自 `PageQueryDto` / `@ApiPaginatedResponse(UserDto)`，
   * 不在这里手写 `@ApiQuery` / `@ApiOkResponse`——契约只有一处定义。
   */
  @Get('list')
  async list(@Query() query: any): Promise<PageResult<UserDto>> {
    const result = await this.appService.list(query);

    return { ...result, list: result.list.map(toUserDto) };
  }
}
