import { AppLoggerService } from '@app/logger';
import { Controller, Get, Query, type DynamicModule } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { IsInt, Min } from 'class-validator';
import { CoreModule } from './core.module.js';
import { ResultCode } from './constants/index.js';
import { RawResponse } from './decorators/index.js';
import { BusinessException } from './exceptions/index.js';

/**
 * 集成测试：验证 CoreModule.forRoot() 的装配真的在 HTTP 请求链路上生效。
 *
 * 单元测试只证明「类单独调用时行为正确」，证明不了「Nest 能把它们装起来」——
 * 例如 `AppValidationPipe` 的构造函数签名是否会被 DI 误解析、`APP_FILTER`
 * 注册的过滤器是否真的接管了异常，都只有真起一个应用才看得出来。
 *
 * 用 FastifyAdapter（与 main.ts 一致）而不是默认的 Express：
 * 本仓库没有装 `@nestjs/platform-express`，且过滤器的响应写入方式在
 * 两种适配器上略有差异，测试环境必须与生产一致。
 */

class PageProbeDto {
  @IsInt()
  @Min(1)
  page!: number;
}

@Controller('probe')
class ProbeController {
  /** 正常返回裸数据，应由拦截器包装 */
  @Get('ok')
  ok() {
    return { id: 1, name: 'probe' };
  }

  /** 无返回值，应归一成 data: null */
  @Get('empty')
  empty(): void {}

  /** 标了 @RawResponse，应原样透传 */
  @RawResponse()
  @Get('raw')
  raw() {
    return { raw: true };
  }

  /** 业务异常，应由过滤器转成统一错误响应 */
  @Get('business')
  business(): never {
    throw new BusinessException(ResultCode.DATA_NOT_FOUND, '用户不存在');
  }

  /** 未知异常，应转成 500 且不透传内部细节 */
  @Get('boom')
  boom(): never {
    throw new Error('connect ECONNREFUSED 10.0.0.5:3306');
  }

  /** 校验失败，应由全局管道拦下 */
  @Get('validated')
  validated(@Query() query: PageProbeDto) {
    return query;
  }
}

describe('coreModule (integration)', () => {
  let app: NestFastifyApplication;

  const logger = {
    setContext: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  } as unknown as AppLoggerService;

  beforeAll(async () => {
    /**
     * CoreModule 的 APP_FILTER 是在**模块内部**注册的，Nest 解析它的构造依赖时
     * 只看 CoreModule 自己的作用域 + 全局模块的 exports。
     *
     * 真实应用里 AppLoggerService 来自 `@Global` 的 AppLoggerModule，所以能解析；
     * 测试里必须复刻这个「全局可见」的前提，直接把替身塞进 testing module 的
     * providers 是不够的（那是根模块作用域，CoreModule 看不到）。
     */
    const loggerStubModule: DynamicModule = {
      module: class LoggerStubModule {},
      global: true,
      providers: [{ provide: AppLoggerService, useValue: logger }],
      exports: [AppLoggerService],
    };

    const moduleRef = await Test.createTestingModule({
      imports: [loggerStubModule, CoreModule.forRoot()],
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('成功响应被包装成统一结构', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/ok' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      code: 0,
      message: '操作成功',
      data: { id: 1, name: 'probe' },
    });
  });

  it('无返回值的接口 data 为 null', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/empty' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ code: 0, message: '操作成功', data: null });
  });

  it('@RawResponse 的接口不被包装', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/raw' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ raw: true });
  });

  it('业务异常被全局过滤器转成统一错误响应', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/business' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 10002,
      message: '用户不存在',
      data: null,
      path: '/probe/business',
      method: 'GET',
    });
  });

  it('未知异常返回 500 且不泄漏内部细节', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ code: 500, message: '服务器内部错误', data: null });
    expect(response.body).not.toContain('10.0.0.5');
  });

  it('全局校验管道拦下非法参数，并给出字段级 details', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/validated?page=abc' });

    expect(response.statusCode).toBe(422);

    const body = response.json();
    expect(body.code).toBe(422);

    // `page=abc` 同时违反 @IsInt 与 @Min(1)，两条约束都会出现在 details 里——
    // 这里不断言具体条数，只断言「每条都能定位到 page 字段」。
    const details = body.details as { field: string; message: string }[];
    expect(details.length).toBeGreaterThan(0);
    expect(details.every((item) => item.field === 'page')).toBe(true);
    expect(details.every((item) => typeof item.message === 'string' && item.message.length > 0)).toBe(true);
  });

  it('合法参数通过校验并完成类型转换', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/validated?page=2' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ code: 0, message: '操作成功', data: { page: 2 } });
  });
});
