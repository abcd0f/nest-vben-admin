import type { z } from 'zod';

import { envSchema } from './env.schema.js';

export type Env = z.infer<typeof envSchema>;

/**
 * 传给 `ConfigModule.forRoot({ validate })` 的校验函数。
 *
 * fail-fast：配置缺失或写错时应用启动即失败，而不是跑到线上才报
 * "cannot read property of undefined"。
 *
 * 副作用说明（@nestjs/config 的实现细节，但很关键）：
 * 本函数返回的**转换后**的值会被回写到 `process.env`（字符串形式），
 * 因此 `registerAs` 的工厂即使拿不到 ConfigService，也能用同一份 schema
 * 重新解析 `process.env` 并拿到一致的结果。
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');

    throw new Error(`环境变量校验失败：\n${details}`);
  }

  return result.data;
}
