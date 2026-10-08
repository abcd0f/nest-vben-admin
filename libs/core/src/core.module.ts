import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/index.js';
import { ResponseInterceptor } from './interceptors/index.js';
import { AppValidationPipe } from './pipes/index.js';

/**
 * 核心横切模块：统一响应、异常处理、参数校验。
 *
 * 为什么用 `APP_PIPE` / `APP_FILTER` / `APP_INTERCEPTOR` 而不是在 `main.ts` 里
 * 调 `app.useGlobalPipes()` / `useGlobalFilters()`：
 * - 用令牌注册的 provider **参与依赖注入**。过滤器要注入 `AppLoggerService`，
 *   在 main.ts 里手动注册就只能 `app.get()` 硬取，且拿不到模块作用域。
 * - 业务侧接入成本降到一行 `CoreModule.forRoot()`，不需要改入口文件。
 *
 * 顺序说明：`ResponseInterceptor` 只做成功响应的包装，异常路径由
 * `AllExceptionsFilter` 接管，两者不重叠。日志模块的 `RequestLogInterceptor`
 * 在 `AppLoggerModule` 中注册，属于更外层，因此它记录的是包装前的状态码与耗时。
 *
 * 接入方式：
 *   // app.module.ts
 *   imports: [AppConfigModule.forRoot(), AppLoggerModule.forRoot(), CoreModule.forRoot(), ...]
 */
@Global()
@Module({})
export class CoreModule {
  static forRoot(): DynamicModule {
    return {
      module: CoreModule,
      global: true,
      providers: [
        { provide: APP_PIPE, useClass: AppValidationPipe },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
      ],
    };
  }
}
