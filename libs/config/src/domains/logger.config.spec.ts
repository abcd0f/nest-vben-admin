import { withEnv } from '../env/env.testing.js';
import { loggerConfig } from './logger.config.js';

const ALL_LOGGER_ENV = {
  LOG_LEVEL: undefined,
  LOG_FILE: undefined,
  LOG_DIR: undefined,
  LOG_REDACT: undefined,
} as const;

describe('loggerConfig', () => {
  it('默认值：level=info、写文件开、目录 logs', () => {
    withEnv({ ...ALL_LOGGER_ENV }, () => {
      const config = loggerConfig();

      expect(config.level).toBe('info');
      expect(config.file).toEqual({ enabled: true, dir: 'logs' });
    });
  });

  it('LOG_FILE=false 关闭文件输出，不会被默认值顶掉', () => {
    withEnv({ ...ALL_LOGGER_ENV, LOG_FILE: 'false' }, () => {
      expect(loggerConfig().file.enabled).toBe(false);
    });
  });

  it('LOG_LEVEL / LOG_DIR 可覆盖', () => {
    withEnv({ ...ALL_LOGGER_ENV, LOG_LEVEL: 'debug', LOG_DIR: '/var/log/gateway' }, () => {
      const config = loggerConfig();

      expect(config.level).toBe('debug');
      expect(config.file.dir).toBe('/var/log/gateway');
    });
  });

  it('LOG_REDACT 追加到默认脱敏列表，去空白、丢空项', () => {
    withEnv({ ...ALL_LOGGER_ENV, LOG_REDACT: 'a.b, c.d ,, ' }, () => {
      const { redact } = loggerConfig();

      expect(redact).toContain('a.b');
      expect(redact).toContain('c.d');
      expect(redact).not.toContain('');
    });
  });

  it('默认脱敏必须覆盖凭据类字段', () => {
    withEnv({ ...ALL_LOGGER_ENV }, () => {
      const { redact } = loggerConfig();

      expect(redact).toContain('req.headers.authorization');
      expect(redact).toContain('req.headers.cookie');
      expect(redact).toContain('password');
      expect(redact).toContain('*.accessToken');
    });
  });
});
