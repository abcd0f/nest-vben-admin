/**
 * `@app/core` —— 跨业务的核心横切能力。
 *
 * 内容：
 * - `constants/`   统一业务状态码（`ResultCode`）与 code → HTTP 状态推导
 * - `interfaces/`  统一响应结构（`ApiResponse` / `ApiErrorResponse`）与类型守卫
 * - `exceptions/`  业务异常（`BusinessException`，携带业务码 / details / cause）
 * - `filters/`     全局异常过滤器（`AllExceptionsFilter`）
 * - `interceptors/`统一响应包装拦截器（`ResponseInterceptor`）
 * - `pipes/`       全局参数校验管道（`AppValidationPipe`）
 * - `decorators/`  `@RawResponse()`：跳过统一响应包装
 *
 * 接入方式（app.module.ts）：
 *   imports: [AppConfigModule.forRoot(), AppLoggerModule.forRoot(), CoreModule.forRoot(), ...]
 *
 * 注意：`guards/` 与 `middleware/` 目录当前为空，原因见各自目录下的说明。
 * 这里刻意不导出它们，避免空的 `export {}` 混进公共 API。
 */
export * from './constants/index.js';
export * from './core.module.js';
export * from './decorators/index.js';
export * from './exceptions/index.js';
export * from './filters/index.js';
export * from './interceptors/index.js';
export * from './interfaces/index.js';
export * from './pipes/index.js';
