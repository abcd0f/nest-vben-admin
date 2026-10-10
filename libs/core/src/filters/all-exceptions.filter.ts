import type { ExceptionFilter } from '@nestjs/common';
import type { ApiErrorResponse } from '../interfaces/index.js';
import { AppLoggerService } from '@app/logger';
import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { resolveHttpStatus, ResultCode } from '../constants/index.js';
import { BusinessException } from '../exceptions/index.js';

/**
 * 只声明实际用到的字段，不绑定具体 HTTP 适配器。
 * Fastify 与 Express 的 request / response 在这几个成员上都兼容。
 */
interface HttpRequestLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface HttpResponseLike {
  status: (code: number) => HttpResponseLike;
  send: (payload: unknown) => unknown;
}

interface ResolvedError {
  httpStatus: number;
  code: number;
  message: string;
  details?: unknown;
  /** 用于写日志的原始异常 */
  cause?: unknown;
}

/** 从 HttpException 的 response 里提取 message 与 details */
function extractHttpPayload(payload: string | object, fallback: string): { message: string; details?: unknown } {
  if (typeof payload === 'string') {
    return { message: payload };
  }

  const record = payload as Record<string, unknown>;
  const raw = record.message;

  // 参数校验失败时 Nest 给的是 string[]，拼成一行给前端直接展示
  if (Array.isArray(raw)) {
    const messages = raw.filter((item): item is string => typeof item === 'string');
    return { message: messages.length > 0 ? messages.join('; ') : fallback, details: raw };
  }

  if (typeof raw === 'string' && raw.length > 0) {
    return { message: raw, details: record.details };
  }

  return { message: fallback, details: record.details };
}

/**
 * 全局异常过滤器。
 *
 * 职责：把**任何**抛出的东西统一成 `ApiErrorResponse` 出网，并按严重程度分级记日志。
 *
 * 关键取舍：
 * - **未知异常的 message 不透传**。原始 `Error.message` 常含 SQL 片段、
 *   文件路径、内网地址；只把它写进日志文件，客户端拿到固定文案 + `requestId`，
 *   靠 `requestId` 去日志里捞现场。
 * - **堆栈只进日志**。响应体里没有 stack 字段。
 * - 4xx 记 `warn`，5xx 记 `error`：前者是客户端用错，后者才需要人介入。
 *
 * 非 HTTP 上下文（ws / rpc）直接 rethrow，交回 Nest 默认处理——
 * 那些场景的响应形态由各自的适配器决定，这里不该插手。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();

    const resolved = this.resolve(exception);
    const requestId = this.readRequestId(request);

    this.writeLog(resolved, request, requestId);

    const body: ApiErrorResponse = {
      code: resolved.code,
      message: resolved.message,
      data: null,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url ?? '',
      method: request.method ?? 'UNKNOWN',
      ...(resolved.details === undefined ? {} : { details: resolved.details }),
      ...(requestId === undefined ? {} : { requestId }),
    };

    response.status(resolved.httpStatus).send(body);
  }

  /** 把任意抛出物归一化成「HTTP 状态 + 业务码 + 文案 + 详情」 */
  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof BusinessException) {
      return {
        httpStatus: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
        cause: exception,
      };
    }

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      const { message, details } = extractHttpPayload(exception.getResponse(), exception.message);

      return {
        httpStatus,
        // HTTP 语义码直接当业务码用，与 ResultCode 的约定保持一致
        code: httpStatus >= HttpStatus.BAD_REQUEST && httpStatus <= 599 ? httpStatus : ResultCode.INTERNAL_SERVER_ERROR,
        message,
        details,
        cause: exception,
      };
    }

    return {
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ResultCode.INTERNAL_SERVER_ERROR,
      message: '服务器内部错误',
      cause: exception,
    };
  }

  private readRequestId(request: HttpRequestLike): string | undefined {
    const header = request.headers?.['x-request-id'];
    const value = Array.isArray(header) ? header[0] : header;

    return value !== undefined && value.length > 0 ? value : undefined;
  }

  private writeLog(resolved: ResolvedError, request: HttpRequestLike, requestId: string | undefined): void {
    const meta = {
      requestId,
      method: request.method ?? 'UNKNOWN',
      url: request.originalUrl ?? request.url ?? '',
      statusCode: resolved.httpStatus,
      code: resolved.code,
    };

    if (resolved.httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`未处理异常: ${resolved.message}`, resolved.cause, meta);
      return;
    }

    this.logger.warn(`请求被拒绝: ${resolved.message}`, meta);
  }
}

/** 供外部复用：把业务码推导 HTTP 状态码的能力再导出一次，避免调用方绕道 constants */
export { resolveHttpStatus };
