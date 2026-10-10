import type { EnvSource } from './env.utils.js';
import { registerAs } from '@nestjs/config';
import { collectEnvValue, optionalEnum, stringValue, throwEnvErrors } from './env.utils.js';

/** 接口文档域原始环境变量 */
export interface SwaggerEnv {
  /** 留空（不声明该变量）= 非生产环境开启、生产环境关闭 */
  SWAGGER_ENABLED?: 'true' | 'false';
  SWAGGER_PATH: string;
  SWAGGER_TITLE: string;
  SWAGGER_DESCRIPTION: string;
  SWAGGER_VERSION: string;
}

/** 接口文档域解析后的配置 */
export interface SwaggerConfig {
  enabled: boolean;
  /** 归一化后的挂载路径，不含前后斜杠 */
  path: string;
  /** OpenAPI JSON 地址，相对 `path` */
  jsonPath: string;
  /** OpenAPI YAML 地址，相对 `path` */
  yamlPath: string;
  title: string;
  description: string;
  version: string;
}

export function parseSwaggerEnv(raw: EnvSource): SwaggerEnv {
  const errors: string[] = [];
  const env = {
    // 刻意不做「空字符串 = 自动」：不声明该变量才是自动。
    // 要显式控制就写 true / false，写空串属于配置错误，直接报出来。
    SWAGGER_ENABLED: collectEnvValue(errors, undefined, () => {
      return optionalEnum(raw, 'SWAGGER_ENABLED', ['true', 'false'] as const);
    }),
    SWAGGER_PATH: collectEnvValue(errors, 'docs', () => stringValue(raw, 'SWAGGER_PATH', 'docs', 1)),
    SWAGGER_TITLE: collectEnvValue(errors, 'Nest Vben Admin API', () => {
      return stringValue(raw, 'SWAGGER_TITLE', 'Nest Vben Admin API', 1);
    }),
    SWAGGER_DESCRIPTION: collectEnvValue(errors, '', () => stringValue(raw, 'SWAGGER_DESCRIPTION', '', 0)),
    SWAGGER_VERSION: collectEnvValue(errors, '1.0.0', () => stringValue(raw, 'SWAGGER_VERSION', '1.0.0', 1)),
  };

  throwEnvErrors(errors);
  return env;
}

/** 去掉首尾斜杠，避免 `/docs/` 与 `docs` 生成出两套地址 */
function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export function createSwaggerConfig(env: SwaggerEnv, nodeEnv = process.env.NODE_ENV): SwaggerConfig {
  const path = trimSlashes(env.SWAGGER_PATH);

  return {
    enabled: env.SWAGGER_ENABLED === undefined ? nodeEnv !== 'production' : env.SWAGGER_ENABLED === 'true',
    path,
    jsonPath: `${path}/json`,
    yamlPath: `${path}/yaml`,
    title: env.SWAGGER_TITLE,
    description: env.SWAGGER_DESCRIPTION,
    version: env.SWAGGER_VERSION,
  };
}

export const swaggerConfig = registerAs('swagger', (): SwaggerConfig => {
  return createSwaggerConfig(parseSwaggerEnv(process.env));
});
