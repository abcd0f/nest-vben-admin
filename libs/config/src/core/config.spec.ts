import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppConfigModule } from '../config.module.js';
import { appDomain } from '../domains/app.domain.js';
import { corsDomain } from '../domains/cors.domain.js';
import { databaseDomain } from '../domains/database.domain.js';
import { DOMAINS } from '../domains/index.js';
import { configSource, resetConfigSource } from './config-loader.js';
import { asBoolean, asInteger, asList, asString } from './parsers.js';
import { compileConfig, getCompiledConfig, resetCompiledConfig } from './validate.js';

const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  process.env.NODE_ENV = 'development';
});

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  resetConfigSource();
  resetCompiledConfig();
});

describe('config parsers', () => {
  it('解析默认值和原生 YAML 类型', () => {
    expect(asString(undefined, 'service.name', 'gateway')).toBe('gateway');
    expect(asBoolean('false', 'service.enabled')).toBe(false);
    expect(asInteger('3', 'service.retries', undefined, 0)).toBe(3);
    expect(asList('a, b', 'service.tags')).toEqual(['a', 'b']);
  });

  it('错误包含配置路径', () => {
    expect(() => asInteger(0, 'database.pool.max', undefined, 1)).toThrow('database.pool.max');
  });
});

describe('config registry', () => {
  it('加载当前环境并编译六个配置域', () => {
    const snapshot = configSource();
    const compiled = compileConfig(DOMAINS, snapshot);

    expect(snapshot.environment).toBe('development');
    expect(compiled.values.size).toBe(6);
    expect(getCompiledConfig('app')).toMatchObject({ port: 6688, nodeEnv: 'development' });
    expect(getCompiledConfig('database')).toMatchObject({ schema: 'public' });
  });

  it('同一快照只编译一次', () => {
    const snapshot = configSource();
    expect(compileConfig(DOMAINS, snapshot)).toBe(compileConfig(DOMAINS, snapshot));
  });

  it('aggregates multiple domain errors', () => {
    const snapshot = {
      environment: 'development' as const,
      values: {
        app: { port: 0 },
        database: { url: {}, pool: { max: 0 } },
      },
    };

    expect(() => compileConfig([appDomain, databaseDomain], snapshot)).toThrow(/app.port/);
    expect(() => compileConfig([appDomain, databaseDomain], snapshot)).toThrow(/database.url/);
  });

  it('捕获域级约束错误', () => {
    const snapshot = {
      environment: 'development' as const,
      values: { cors: { origin: ['*', 'https://example.com'], credentials: false } },
    };

    expect(() => compileConfig([corsDomain], snapshot)).toThrow(/cors.origin/);
  });

  it('reads compiled domain config through Nest', async () => {
    const module = await Test.createTestingModule({ imports: [AppConfigModule.forRoot()] }).compile();
    const config = module.get(ConfigService);

    expect(config.get('app.port')).toBe(6688);
    expect(config.get('database.pool.max')).toBe(10);
  });
});
