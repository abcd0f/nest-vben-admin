import { HttpException } from '@nestjs/common';
import { resolveHttpStatus, ResultCode, resultCodeMessage } from '../constants/index.js';

export interface BusinessExceptionOptions {
  /** 覆盖由 `code` 推导出的 HTTP 状态码（默认走 `resolveHttpStatus()`） */
  httpStatus?: number;
  /** 附加信息：参数校验失败时的字段错误列表等 */
  details?: unknown;
  /** 原始异常，保留因果链，便于日志排查 */
  cause?: unknown;
}

/**
 * 业务异常。
 *
 * 与直接 `throw new BadRequestException()` 的区别：
 * 1. 携带**业务状态码**（`code`），与 HTTP 状态码解耦——
 *    例如「数据不存在」可以返回 HTTP 400 + 业务码 10002，前端按业务码分流；
 * 2. 支持 `details`，参数校验失败时能把字段级错误原样带给前端；
 * 3. 由 `AllExceptionsFilter` 统一序列化，业务代码不关心响应格式。
 *
 * 用法：
 *   throw new BusinessException(ResultCode.DATA_NOT_FOUND, '用户不存在');
 *   throw BusinessException.notFound('用户不存在');
 */
export class BusinessException extends HttpException {
  /** 业务状态码 */
  readonly code: number;

  /** 附加信息 */
  readonly details?: unknown;

  constructor(code: number = ResultCode.BUSINESS_ERROR, message?: string, options: BusinessExceptionOptions = {}) {
    const text = message ?? resultCodeMessage(code);
    const httpStatus = options.httpStatus ?? resolveHttpStatus(code);

    // 第三个参数保留 cause：日志里能看到「业务异常 ← 底层驱动错误」的因果链，
    // 而出网响应体只取 code / message / details（见 AllExceptionsFilter）。
    super({ code, message: text, details: options.details }, httpStatus, { cause: options.cause });

    this.code = code;
    this.details = options.details;
    this.name = 'BusinessException';
  }

  /** 等价于 `new BusinessException(...)`，用于链式 / 泛型场景 */
  static of(code: number, message?: string, options?: BusinessExceptionOptions): BusinessException {
    return new BusinessException(code, message, options);
  }

  static badRequest(message?: string, options?: BusinessExceptionOptions): BusinessException {
    return new BusinessException(ResultCode.BAD_REQUEST, message, options);
  }

  static unauthorized(message?: string, options?: BusinessExceptionOptions): BusinessException {
    return new BusinessException(ResultCode.UNAUTHORIZED, message, options);
  }

  static forbidden(message?: string, options?: BusinessExceptionOptions): BusinessException {
    return new BusinessException(ResultCode.FORBIDDEN, message, options);
  }

  static notFound(message?: string, options?: BusinessExceptionOptions): BusinessException {
    return new BusinessException(ResultCode.NOT_FOUND, message, options);
  }

  static conflict(message?: string, options?: BusinessExceptionOptions): BusinessException {
    return new BusinessException(ResultCode.CONFLICT, message, options);
  }

  static business(message?: string, options?: BusinessExceptionOptions): BusinessException {
    return new BusinessException(ResultCode.BUSINESS_ERROR, message, options);
  }

  static internal(message?: string, options?: BusinessExceptionOptions): BusinessException {
    return new BusinessException(ResultCode.INTERNAL_SERVER_ERROR, message, options);
  }
}
