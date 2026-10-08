import { z } from 'zod';

/**
 * 环境变量契约：所有变量在此声明、校验并转换类型。
 *
 * 为什么用 zod 而不是直接读 process.env：
 * - fail-fast：配置缺失/写错时应用启动即失败，而不是跑到线上才报 "cannot read property of undefined"。
 * - 类型收敛：PORT / POOL_MAX 出来就是 number，不用到处 Number(...)。
 * - 单一事实来源：新增配置只改这一处。
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // ---------- PostgreSQL ----------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 必填，例如 postgresql://user:pass@host:5432/db'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_POOL_IDLE_TIMEOUT: z.coerce.number().int().nonnegative().default(10_000),
  DATABASE_CONNECT_TIMEOUT: z.coerce.number().int().nonnegative().default(5_000),
  DATABASE_LOG_QUERIES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * 传给 ConfigModule.forRoot({ validate }) 的校验函数。
 * 校验失败直接抛错，阻断启动。
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
