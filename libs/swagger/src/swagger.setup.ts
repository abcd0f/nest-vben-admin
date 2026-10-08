import type { INestApplication } from '@nestjs/common';

import { AppSwaggerService, type SwaggerDocsPaths } from './swagger.service.js';

/**
 * 挂载接口文档，返回访问路径（未启用时返回 `undefined`）。
 *
 * 放在 main.ts 的 `app.listen()` 之前调用：
 *
 * ```ts
 * import { setupSwagger } from '@app/swagger';
 *
 * const app = await NestFactory.create(AppModule, new FastifyAdapter());
 * const docs = setupSwagger(app);          // ← 就这一行
 * if (docs) console.log(`Swagger UI: ${docs.ui}`);
 * await app.listen(port, '0.0.0.0');
 * ```
 *
 * 用函数而不是让调用方自己 `app.get(AppSwaggerService).setup(app)`：
 * 业务入口不必知道内部有哪个 service，将来换实现也不影响 main.ts。
 */
export function setupSwagger(app: INestApplication): SwaggerDocsPaths | undefined {
  return app.get(AppSwaggerService).setup(app);
}
