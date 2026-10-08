import { withEnv } from '../env/env.testing.js';
import { swaggerConfig } from './swagger.config.js';

const ALL_SWAGGER_ENV = {
  SWAGGER_ENABLED: undefined,
  SWAGGER_PATH: undefined,
  SWAGGER_TITLE: undefined,
  SWAGGER_DESCRIPTION: undefined,
  SWAGGER_VERSION: undefined,
  SWAGGER_SERVER_URL: undefined,
  SWAGGER_JSON_URL: undefined,
  SWAGGER_YAML_URL: undefined,
  SWAGGER_PERSIST_AUTHORIZATION: undefined,
} as const;

describe('swaggerConfig', () => {
  it('默认值：路径 docs、版本 1.0.0、JSON/YAML 路径由 path 派生', () => {
    withEnv({ ...ALL_SWAGGER_ENV, NODE_ENV: 'development' }, () => {
      const config = swaggerConfig();

      expect(config.path).toBe('docs');
      expect(config.version).toBe('1.0.0');
      expect(config.jsonUrl).toBe('docs/json');
      expect(config.yamlUrl).toBe('docs/yaml');
      expect(config.serverUrl).toBeUndefined();
    });
  });

  it('未显式配置时：非生产环境开启、生产环境关闭', () => {
    withEnv({ ...ALL_SWAGGER_ENV, NODE_ENV: 'development' }, () => {
      expect(swaggerConfig().enabled).toBe(true);
    });

    withEnv({ ...ALL_SWAGGER_ENV, NODE_ENV: 'test' }, () => {
      expect(swaggerConfig().enabled).toBe(true);
    });

    withEnv({ ...ALL_SWAGGER_ENV, NODE_ENV: 'production' }, () => {
      expect(swaggerConfig().enabled).toBe(false);
    });
  });

  it('SWAGGER_ENABLED 可以覆盖环境推断（生产也能强制打开）', () => {
    withEnv({ ...ALL_SWAGGER_ENV, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }, () => {
      expect(swaggerConfig().enabled).toBe(true);
    });

    withEnv({ ...ALL_SWAGGER_ENV, NODE_ENV: 'development', SWAGGER_ENABLED: 'false' }, () => {
      expect(swaggerConfig().enabled).toBe(false);
    });
  });

  it('SWAGGER_PATH 前后斜杠被归一化，JSON/YAML 路径跟随', () => {
    withEnv({ ...ALL_SWAGGER_ENV, SWAGGER_PATH: '/api-docs/' }, () => {
      const config = swaggerConfig();

      expect(config.path).toBe('api-docs');
      expect(config.jsonUrl).toBe('api-docs/json');
      expect(config.yamlUrl).toBe('api-docs/yaml');
    });
  });

  it('SWAGGER_JSON_URL / SWAGGER_YAML_URL 可独立覆盖', () => {
    withEnv({ ...ALL_SWAGGER_ENV, SWAGGER_JSON_URL: '/openapi.json', SWAGGER_YAML_URL: '' }, () => {
      const config = swaggerConfig();

      expect(config.jsonUrl).toBe('openapi.json');
      // 空串视同未设置 → 回落默认值
      expect(config.yamlUrl).toBe('docs/yaml');
    });
  });

  it('空串的 SWAGGER_SERVER_URL 视同未设置，不产生非法 server', () => {
    withEnv({ ...ALL_SWAGGER_ENV, SWAGGER_SERVER_URL: '  ' }, () => {
      expect(swaggerConfig().serverUrl).toBeUndefined();
    });
  });

  it('SWAGGER_SERVER_URL 正常读取', () => {
    withEnv({ ...ALL_SWAGGER_ENV, SWAGGER_SERVER_URL: 'https://api.example.com' }, () => {
      expect(swaggerConfig().serverUrl).toBe('https://api.example.com');
    });
  });

  it('SWAGGER_PERSIST_AUTHORIZATION 只认字面量 true / false', () => {
    withEnv({ ...ALL_SWAGGER_ENV, SWAGGER_PERSIST_AUTHORIZATION: 'false' }, () => {
      expect(swaggerConfig().persistAuthorization).toBe(false);
    });

    withEnv({ ...ALL_SWAGGER_ENV, SWAGGER_PERSIST_AUTHORIZATION: 'yes' }, () => {
      expect(() => swaggerConfig()).toThrow();
    });
  });
});
