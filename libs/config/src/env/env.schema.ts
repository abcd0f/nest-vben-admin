import { z } from 'zod';

import { appEnvSchema } from '../domains/app.config.js';
import { databaseEnvSchema } from '../domains/database.config.js';
import { loggerEnvSchema } from '../domains/logger.config.js';
import { swaggerEnvSchema } from '../domains/swagger.config.js';

/**
 * 全局环境变量契约。
 *
 * 由各配置域自己的 schema 组合而成——**新增一个配置域时，只需要：
 *   1. 在 `domains/` 下加一个文件，导出 `<域>EnvSchema`
 *   2. 在这里 spread 进来
 *   3. 在 `config.module.ts` 的 `load` 数组里加一个 registerAs 配置
 * 环境变量的校验规则、默认值、类型转换都写在各自的域文件里，本文件只做汇总。
 */
export const envSchema = z.object({
  ...appEnvSchema.shape,
  ...databaseEnvSchema.shape,
  ...loggerEnvSchema.shape,
  ...swaggerEnvSchema.shape,
});
