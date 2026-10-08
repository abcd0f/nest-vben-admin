import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH } from '../swagger.constants.js';

/**
 * 声明接口需要 Bearer 认证。
 *
 * 等价于 `@ApiBearerAuth(SWAGGER_BEARER_AUTH)`，但：
 * - 方案名收敛到一个常量，不会和 `addBearerAuth()` 里注册的名字对不上；
 * - 语义更直白，controller 上写 `@ApiAuth()` 比写 `@ApiBearerAuth()` 好读。
 *
 * 配套的 401 响应由 `@ApiCommonErrors()` 负责，不要在这里重复声明。
 */
export function ApiAuth(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiBearerAuth(SWAGGER_BEARER_AUTH));
}
