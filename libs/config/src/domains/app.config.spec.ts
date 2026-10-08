import { withEnv } from '../env/env.testing.js';
import { appConfig, appEnvSchema } from './app.config.js';

describe('appConfig', () => {
  it('默认值：development / 3000', () => {
    withEnv({ NODE_ENV: undefined, PORT: undefined }, () => {
      expect(appConfig()).toEqual({ nodeEnv: 'development', port: 3000, isProduction: false });
    });
  });

  it('读取并转换 PORT，生产环境标记 isProduction', () => {
    withEnv({ NODE_ENV: 'production', PORT: '8080' }, () => {
      expect(appConfig()).toEqual({ nodeEnv: 'production', port: 8080, isProduction: true });
    });
  });

  it('非法 PORT 被 schema 拒绝', () => {
    withEnv({ PORT: 'abc' }, () => {
      expect(() => appEnvSchema.parse(process.env)).toThrow();
    });
  });

  it('非法 NODE_ENV 被 schema 拒绝', () => {
    withEnv({ NODE_ENV: 'staging' }, () => {
      expect(() => appEnvSchema.parse(process.env)).toThrow();
    });
  });
});
