import { asBoolean, asObject, asString, defineConfigDomain } from '../core/index.js';

export interface SwaggerConfig {
  enabled: boolean;
  path: string;
  jsonPath: string;
  yamlPath: string;
  title: string;
  description: string;
  version: string;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export const swaggerDomain = defineConfigDomain<SwaggerConfig>({
  namespace: 'swagger',
  parse(raw, context): SwaggerConfig {
    const value = asObject(raw, 'swagger');
    const path = trimSlashes(asString(value.path, 'swagger.path', 'docs'));
    if (!path) throw new Error('swagger.path: 不能为空');

    const enabled =
      value.enabled === undefined ? context.environment !== 'production' : asBoolean(value.enabled, 'swagger.enabled');

    return {
      enabled,
      path,
      jsonPath: `${path}/json`,
      yamlPath: `${path}/yaml`,
      title: asString(value.title, 'swagger.title', 'Nest Vben Admin API'),
      description: asString(value.description, 'swagger.description', ''),
      version: asString(value.version, 'swagger.version', '1.0.0'),
    };
  },
});

export const swaggerConfig = swaggerDomain.token;
