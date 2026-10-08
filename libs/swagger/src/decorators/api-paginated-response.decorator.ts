import type { Type } from '@nestjs/common';
import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, type ApiResponseOptions } from '@nestjs/swagger';

import { PaginatedDto } from '../dto/paginated.dto.js';

/**
 * 声明「分页列表」响应，一次搞定响应类型 + schema 注册。
 *
 * 用法：
 *   @Get('users')
 *   @ApiPaginatedResponse(UserDto)
 *   list(@Query() query: PageQueryDto) {}
 *
 * 展开后等价于 `@ApiOkResponse({ type: PaginatedDto(UserDto) })`。
 * 不需要额外写 `@ApiExtraModels`：`type` 本身就完成注册，
 * 而 `PaginatedDto()` 有缓存，多处调用拿到的是同一个类。
 *
 * @param model 列表元素的 DTO
 * @param description 响应描述，覆盖默认值
 */
export function ApiPaginatedResponse<T>(model: Type<T>, description = '分页结果'): MethodDecorator & ClassDecorator {
  const options: ApiResponseOptions = {
    description,
    type: PaginatedDto(model),
  };

  return applyDecorators(ApiOkResponse(options));
}
