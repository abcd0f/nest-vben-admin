import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/** 应用级环境变量契约 */
export const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type NodeEnv = z.infer<typeof appEnvSchema>['NODE_ENV'];

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  isProduction: boolean;
}

/**
 * 应用级配置。
 *
 * 关于 `process.env`：`registerAs` 的工厂在 @nestjs/config 内部是以
 * `inject: []` 注册的，**拿不到 ConfigService**，只能读 process.env。
 * 所以这里复用上面同一份 schema 做解析——校验规则、默认值、类型转换只有一处定义，
 * 而 `validateEnv` 会把转换后的值回写到 process.env，两边结果一致。
 */
export const appConfig = registerAs('app', (): AppConfig => {
  const env = appEnvSchema.parse(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    isProduction: env.NODE_ENV === 'production',
  };
});
