import type { ConfigService } from '@nestjs/config';
import { resolveLoggerConfig } from './logger.config.js';

/** 只用到 ConfigService.get 的极简替身 */
function createConfigService(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue,
  } as unknown as ConfigService;
}

describe('loggerConfig', () => {
  it('默认值：level=info、写文件开、目录 logs', () => {
    const config = resolveLoggerConfig(createConfigService({}));

    expect(config.level).toBe('info');
    expect(config.file.enabled).toBe(true);
    expect(config.file.dir).toBe('logs');
  });

  it('LOG_LEVEL / LOG_FILE / LOG_DIR 均可覆盖', () => {
    const config = resolveLoggerConfig(
      createConfigService({ LOG_LEVEL: 'debug', LOG_FILE: false, LOG_DIR: '/var/log/gateway' }),
    );

    expect(config.level).toBe('debug');
    expect(config.file.enabled).toBe(false);
    expect(config.file.dir).toBe('/var/log/gateway');
  });

  it('LOG_FILE=false 不会被默认值 true 顶掉', () => {
    // 回归保护：内部用 `??` 而不是 `||`，否则 false 会被当成缺省值
    expect(resolveLoggerConfig(createConfigService({ LOG_FILE: false })).file.enabled).toBe(false);
  });

  it('LOG_REDACT 以逗号追加脱敏路径，且去空白、丢空项', () => {
    const { redact } = resolveLoggerConfig(createConfigService({ LOG_REDACT: 'a.b, c.d ,, ' }));

    expect(redact).toContain('a.b');
    expect(redact).toContain('c.d');
    expect(redact).not.toContain('');
  });

  it('默认脱敏必须覆盖凭据类字段', () => {
    const { redact } = resolveLoggerConfig(createConfigService({}));

    expect(redact).toContain('req.headers.authorization');
    expect(redact).toContain('req.headers.cookie');
    expect(redact).toContain('password');
    expect(redact).toContain('*.accessToken');
  });
});
