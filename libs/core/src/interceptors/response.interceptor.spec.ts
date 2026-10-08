import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { RawResponse } from '../decorators/index.js';
import { ResponseInterceptor } from './response.interceptor.js';

function createContext(handler: () => unknown, cls: object = class {}): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

function createNext(data: unknown): CallHandler {
  return { handle: () => of(data) } as CallHandler;
}

class TestController {
  @RawResponse()
  raw(): void {}

  normal(): void {}
}

describe('responseInterceptor', () => {
  const interceptor = new ResponseInterceptor(new Reflector());

  it('把裸数据包装成统一响应结构', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(createContext(TestController.prototype.normal, TestController), createNext({ id: 1 })),
    );

    expect(result).toEqual({ code: 0, message: '操作成功', data: { id: 1 } });
  });

  it('undefined 归一成 data: null，而不是丢掉 data 字段', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(createContext(TestController.prototype.normal, TestController), createNext(undefined)),
    );

    expect(result).toEqual({ code: 0, message: '操作成功', data: null });
  });

  it('返回值已是 ApiResponse 结构时不二次包装', async () => {
    const payload = { code: 10001, message: '自定义', data: [1, 2] };
    const result = await firstValueFrom(
      interceptor.intercept(createContext(TestController.prototype.normal, TestController), createNext(payload)),
    );

    expect(result).toEqual(payload);
  });

  it('@RawResponse 标注的方法跳过包装', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(createContext(TestController.prototype.raw, TestController), createNext('raw-data')),
    );

    expect(result).toBe('raw-data');
  });

  it('非 HTTP 上下文不做处理', async () => {
    const rpcContext = {
      getType: () => 'rpc',
      getHandler: () => TestController.prototype.normal,
      getClass: () => TestController,
    } as unknown as ExecutionContext;

    const result = await firstValueFrom(interceptor.intercept(rpcContext, createNext('payload')));

    expect(result).toBe('payload');
  });
});
