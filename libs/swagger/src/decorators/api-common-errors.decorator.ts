import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../dto/api-error.dto.js';

/**
 * 一次性声明接口的「通用失败响应」：400 / 401 / 403 / 500。
 *
 * 为什么值得封装：这四行几乎每个接口都要写，不封装的结果是有人写有人不写，
 * 前端只能靠猜。响应体统一为 `ApiErrorDto`（与 Nest 默认异常序列化一致）。
 *
 * 用法：
 *   @Get('users')
 *   @ApiCommonErrors()
 *   list() {}
 */
export function ApiCommonErrors(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiBadRequestResponse({ type: ApiErrorDto, description: '参数校验失败' }),
    ApiUnauthorizedResponse({ type: ApiErrorDto, description: '未认证或 token 已失效' }),
    ApiForbiddenResponse({ type: ApiErrorDto, description: '已认证但无权限' }),
    ApiInternalServerErrorResponse({ type: ApiErrorDto, description: '服务端异常' }),
  );
}
