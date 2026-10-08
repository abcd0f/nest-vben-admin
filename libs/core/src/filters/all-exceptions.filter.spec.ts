import type { AppLoggerService } from '@app/logger';
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { ResultCode } from '../constants/index.js';
import { BusinessException } from '../exceptions/index.js';
import type { ApiErrorResponse } from '../interfaces/index.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

interface CapturedResponse {
  statusCode: number;
  body: ApiErrorResponse;
  status(code: number): CapturedResponse;
  send(payload: ApiErrorResponse): CapturedResponse;
}

function createHost(headers: Record<string, string> = {}) {
  const response = {
    statusCode: 0,
    body: undefined as unknown as ApiErrorResponse,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: ApiErrorResponse) {
      this.body = payload;
      return this;
    },
  } satisfies CapturedResponse;

  const request = { method: 'GET', url: '/users?page=1', originalUrl: '/users?page=1', headers };

  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('allExceptionsFilter', () => {
  const logger = {
    setContext: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  } as unknown as AppLoggerService;

  const filter = new AllExceptionsFilter(logger);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('业务异常：透传业务码与 details，HTTP 状态按业务码推导', () => {
    const { host, response } = createHost();

    filter.catch(new BusinessException(ResultCode.DATA_NOT_FOUND, '用户不存在'), host);

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      code: 10002,
      message: '用户不存在',
      data: null,
      path: '/users?page=1',
      method: 'GET',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('业务异常：details 原样带给客户端', () => {
    const { host, response } = createHost();
    const details = [{ field: 'page', message: 'page 必须是整数' }];

    filter.catch(new BusinessException(ResultCode.UNPROCESSABLE_ENTITY, '校验失败', { details }), host);

    expect(response.statusCode).toBe(422);
    expect(response.body.details).toEqual(details);
  });

  it('HttpException：HTTP 状态码直接作为业务码', () => {
    const { host, response } = createHost();

    filter.catch(new NotFoundException('找不到该资源'), host);

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe(404);
    expect(response.body.message).toBe('找不到该资源');
  });

  it('HttpException：message 为数组时拼成一行，并保留原始数组到 details', () => {
    const { host, response } = createHost();

    filter.catch(new BadRequestException(['a 必填', 'b 必须是字符串']), host);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('a 必填; b 必须是字符串');
    expect(response.body.details).toEqual(['a 必填', 'b 必须是字符串']);
  });

  it('未知异常：返回 500 且不透传原始 message', () => {
    const { host, response } = createHost();

    filter.catch(new Error('connect ECONNREFUSED 10.0.0.5:3306'), host);

    expect(response.statusCode).toBe(500);
    expect(response.body.code).toBe(500);
    expect(response.body.message).toBe('服务器内部错误');
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.5');
  });

  it('未知异常：原始异常进日志，且按 error 级别记录', () => {
    const { host } = createHost();
    const boom = new Error('boom');

    filter.catch(boom, host);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect((logger.error as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(boom);
  });

  it('4xx 走 warn 级别，不占用 error', () => {
    const { host } = createHost();

    filter.catch(new NotFoundException(), host);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('响应头带 x-request-id 时写进响应体', () => {
    const { host, response } = createHost({ 'x-request-id': 'trace-123' });

    filter.catch(new BusinessException(ResultCode.BUSINESS_ERROR), host);

    expect(response.body.requestId).toBe('trace-123');
  });

  it('没有 x-request-id 时不写该字段', () => {
    const { host, response } = createHost();

    filter.catch(new BusinessException(ResultCode.BUSINESS_ERROR), host);

    expect(response.body.requestId).toBeUndefined();
    expect('requestId' in response.body).toBe(false);
  });

  it('非 HTTP 上下文原样抛出，交回 Nest 默认处理', () => {
    const rpcHost = { getType: () => 'rpc' } as unknown as ArgumentsHost;
    const boom = new Error('rpc error');

    expect(() => filter.catch(boom, rpcHost)).toThrow(boom);
  });
});
