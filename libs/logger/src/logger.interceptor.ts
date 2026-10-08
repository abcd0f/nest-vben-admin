import { randomUUID } from 'node:crypto';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { tap, type Observable } from 'rxjs';
import { AppLoggerService } from './logger.service.js';

/** 只声明实际用到的字段，避免绑定具体 HTTP 适配器（Fastify / Express 都适用） */
interface HttpRequestLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface HttpResponseLike {
  statusCode?: number;
  /** Fastify reply */
  header?: (name: string, value: string) => unknown;
  /** Express / 原生 response */
  setHeader?: (name: string, value: string) => void;
}

/**
 * 解析请求 ID：优先复用上游透传的 x-request-id（便于跨服务串联一次调用），
 * 没有则生成，并尽力回写到响应头。
 */
function resolveRequestId(request: HttpRequestLike, response: HttpResponseLike): string {
  const header = request.headers?.['x-request-id'];
  const requestId = (Array.isArray(header) ? header[0] : header) || randomUUID();

  if (typeof response.header === 'function') {
    response.header('x-request-id', requestId);
  } else if (typeof response.setHeader === 'function') {
    response.setHeader('x-request-id', requestId);
  }

  return requestId;
}

/**
 * HTTP 请求日志拦截器。
 *
 * 用拦截器而不是中间件，是为了不绑定具体适配器：`switchToHttp()` 给出的
 * request/response 在 Fastify 和 Express 下都能用，而 Nest 中间件在 Fastify 下
 * 依赖 @fastify/middie，拿到的对象形态不稳定。
 *
 * 覆盖范围：能进到 controller 的请求。路由不存在（404）或更早失败的请求不会经过这里。
 */
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();

    const requestId = resolveRequestId(request, response);
    const startedAt = Date.now();
    const method = request.method ?? 'UNKNOWN';
    const url = request.originalUrl ?? request.url ?? '';

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.info('请求完成', {
            requestId,
            method,
            url,
            statusCode: response.statusCode ?? 200,
            durationMs: Date.now() - startedAt,
          });
        },
        error: (error: unknown) => {
          this.logger.error('请求异常', error, {
            requestId,
            method,
            url,
            statusCode: response.statusCode ?? 500,
            durationMs: Date.now() - startedAt,
          });
        },
      }),
    );
  }
}
