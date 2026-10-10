import type { NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { ApiResponse } from '../interfaces/index.js';
import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs';
import { ResultCode, resultCodeMessage } from '../constants/index.js';
import { SKIP_RESPONSE_WRAP } from '../decorators/index.js';
import { isApiResponse } from '../interfaces/index.js';

/**
 * 统一响应包装拦截器。
 *
 * 把 controller 返回的裸数据包成 `{ code, message, data }`，
 * 让业务代码只关心数据本身，格式收敛在这一处。
 *
 * 三条不做包装的情况：
 * 1. 非 HTTP 上下文（ws / rpc）；
 * 2. 方法或类上标了 `@RawResponse()`；
 * 3. 返回值本身已是 `ApiResponse` 结构（`isApiResponse` 识别）——
 *    避免 BFF 类接口自行拼装的响应被包成 `{ code, message, data: { code, ... } }`。
 *
 * 注意：`undefined` 会归一成 `data: null`，而不是让 `data` 字段消失。
 * 前端少一个判空分支，契约也更稳定。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    // getAllAndOverride：方法上的标记优先于类上的
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAP, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(map((data) => (isApiResponse(data) ? data : this.wrap(data))));
  }

  private wrap(data: T): ApiResponse<T> {
    return {
      code: ResultCode.SUCCESS,
      message: resultCodeMessage(ResultCode.SUCCESS),
      data: data === undefined ? null : data,
    };
  }
}
