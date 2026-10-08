import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';

import { AppSwaggerService } from './swagger.service.js';

/**
 * 接口文档模块（OpenAPI 3 + Swagger UI）。
 *
 * 标 `@Global` 的理由和 AppLoggerModule 一样：这是全局基础设施，
 * 业务模块不需要 import 任何东西。
 *
 * 用法（两步）：
 *   1. AppModule 的 imports 里加 `AppSwaggerModule.forRoot()`
 *   2. main.ts 里在 `app.listen()` **之前** 调 `setupSwagger(app)`
 *
 * 关不关、挂在哪、叫什么名字，全部由 `@app/config` 的 swagger 域决定
 * （见 libs/config/src/swagger.config.ts）。
 */
@Global()
@Module({})
export class AppSwaggerModule {
  static forRoot(): DynamicModule {
    return {
      module: AppSwaggerModule,
      global: true,
      providers: [AppSwaggerService],
      exports: [AppSwaggerService],
    };
  }
}
