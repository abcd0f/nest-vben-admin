import { defineConfigDomain } from '../core/index.js';

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

/** 去掉首尾斜杠，避免 `/docs/` 与 `docs` 生成出两套地址 */
function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export const swaggerDomain = defineConfigDomain({
  namespace: 'swagger',
  fields: {
    // 刻意不做「空字符串 = 自动」：不声明该变量才是自动。
    // 要显式控制就写 true / false，写空串属于配置错误，直接报出来。
    enabled: { type: 'enum', values: ['true', 'false'], optional: true },
    path: { type: 'string', default: 'docs', minLength: 1 },
    title: { type: 'string', default: 'Nest Vben Admin API', minLength: 1 },
    description: { type: 'string', default: '', minLength: 0 },
    version: { type: 'string', default: '1.0.0', minLength: 1 },
  },
  resolve: (values, context): SwaggerConfig => {
    const path = trimSlashes(values.path);

    return {
      // 不声明 SWAGGER_ENABLED = 非生产环境开启、生产环境关闭
      enabled: values.enabled === undefined ? context.environment !== 'production' : values.enabled === 'true',
      path,
      jsonPath: `${path}/json`,
      yamlPath: `${path}/yaml`,
      title: values.title,
      description: values.description,
      version: values.version,
    };
  },
});

export const swaggerConfig = swaggerDomain.token;
