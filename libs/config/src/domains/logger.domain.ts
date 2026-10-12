import { defineConfigDomain } from '../core/index.js';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevelName = (typeof LOG_LEVELS)[number];

export interface LoggerFileConfig {
  enabled: boolean;
  dir: string;
}

export interface LoggerConfig {
  level: LogLevelName;
  file: LoggerFileConfig;
  /** 需要脱敏的字段路径 = 默认项 + LOG_REDACT 追加项 */
  redact: string[];
}

const DEFAULT_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-auth-token"]',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  '*.oldPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.apiKey',
];

/**
 * 日志域。
 *
 * `envPrefix: 'LOG_'` —— 命名空间叫 `logger`，但变量名是 `LOG_*`，故显式覆盖前缀。
 */
export const loggerDomain = defineConfigDomain({
  namespace: 'logger',
  envPrefix: 'LOG_',
  fields: {
    level: { type: 'enum', values: LOG_LEVELS, default: 'info' },
    file: { type: 'boolean', default: true },
    dir: { type: 'string', default: 'logs', minLength: 1 },
    redact: { type: 'csv', optional: true },
  },
  resolve: (values): LoggerConfig => ({
    level: values.level,
    file: { enabled: values.file, dir: values.dir },
    redact: [...DEFAULT_REDACT_PATHS, ...(values.redact ?? [])],
  }),
});

export const loggerConfig = loggerDomain.token;
