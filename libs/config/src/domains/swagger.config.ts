import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { booleanEnv, optionalString } from '../env/env.utils.js';

/** Swagger 环境变量契约 */
export const swaggerEnvSchema = z.object({
  /**
   * 是否挂载接口文档。
   *
   * 刻意不在这里给 default：留空表示「按环境决定」——
   * 非生产环境开启、生产环境关闭，避免接口文档随生产环境裸奔。
   * 要强制覆盖就显式写 true / false。
   */
  SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
  /** UI 与文档的挂载路径（相对根路径，前后斜杠会被归一化掉） */
  SWAGGER_PATH: z.string().min(1).default('docs'),
  SWAGGER_TITLE: z.string().min(1).default('Nest Vben Admin API'),
  SWAGGER_DESCRIPTION: z.string().default(''),
  SWAGGER_VERSION: z.string().min(1).default('1.0.0'),
  /** 显式声明服务地址（网关/域名前置时用）；留空则沿用请求自身的 origin */
  SWAGGER_SERVER_URL: optionalString(),
  /** OpenAPI JSON / YAML 的下载路径，默认 `<SWAGGER_PATH>/json` 与 `<SWAGGER_PATH>/yaml` */
  SWAGGER_JSON_URL: optionalString(),
  SWAGGER_YAML_URL: optionalString(),
  /** Swagger UI 是否在刷新后保留已填写的 token。生产环境建议关掉 */
  SWAGGER_PERSIST_AUTHORIZATION: booleanEnv('true'),
});

export interface SwaggerConfig {
  enabled: boolean;
  /** 归一化后的路径，不含前后斜杠 */
  path: string;
  title: string;
  description: string;
  version: string;
  serverUrl?: string;
  jsonUrl: string;
  yamlUrl: string;
  persistAuthorization: boolean;
}

/** 去掉首尾斜杠，保证 `docs` / `/docs/` / `//docs//` 等价 */
function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

/** Swagger 配置。工厂只读 process.env，理由见 app.config.ts 的注释。 */
export const swaggerConfig = registerAs('swagger', (): SwaggerConfig => {
  const env = swaggerEnvSchema.parse(process.env);

  const enabled =
    env.SWAGGER_ENABLED === undefined ? process.env.NODE_ENV !== 'production' : env.SWAGGER_ENABLED === 'true';

  const path = trimSlashes(env.SWAGGER_PATH);

  return {
    enabled,
    path,
    title: env.SWAGGER_TITLE,
    description: env.SWAGGER_DESCRIPTION,
    version: env.SWAGGER_VERSION,
    serverUrl: env.SWAGGER_SERVER_URL,
    jsonUrl: trimSlashes(env.SWAGGER_JSON_URL ?? `${path}/json`),
    yamlUrl: trimSlashes(env.SWAGGER_YAML_URL ?? `${path}/yaml`),
    persistAuthorization: env.SWAGGER_PERSIST_AUTHORIZATION,
  };
});
