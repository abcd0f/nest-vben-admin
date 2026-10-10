import type { INestApplication } from '@nestjs/common';

import type { SwaggerDocsPaths } from './swagger.service.js';
import { AppSwaggerService } from './swagger.service.js';

/**
 * 挂载接口文档，返回访问路径（未启用时返回 `undefined`）。
 *
 * 放在 `main.ts` 的 `app.listen()` 之前调用：
 *
 * ```ts
 * import { setupSwagger } from '@app/swagger';
 * import metadata from './metadata.js';   // ← 由 generate-swagger-metadata.mjs 生成
 *
 * const app = await NestFactory.create(AppModule, new FastifyAdapter());
 * const docs = await setupSwagger(app, metadata);   // ← 就这一行
 * if (docs) console.log(`Swagger UI: ${docs.ui}`);
 * await app.listen(port, '0.0.0.0');
 * ```
 *
 * `metadata` 必须在这里传进来而不是写死在 libs/swagger 里：它由各应用自己的
 * 源码生成（`apps/<app>/src/metadata.ts`），库不该知道是哪个应用。
 * 不传 = 只有文档骨架、没有注释描述（也能跑，但没意义）。
 *
 * 用函数而不是让调用方自己 `app.get(AppSwaggerService).setup(app)`：
 * 业务入口不必知道内部有哪个 service，将来换实现也不影响 main.ts。
 */
export async function setupSwagger(app: INestApplication): Promise<SwaggerDocsPaths | undefined> {
  return app.get(AppSwaggerService).setup(app);
}
