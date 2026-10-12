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
  /** 需要脱敏的字段路径 = 默认项 + logger.redact 追加项 */
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
 * 日志域。文件开关与目录嵌在 `logger.file.*` 下，与最终 Config 的形状一致。
 */
export const loggerDomain = defineConfigDomain({
  namespace: 'logger',
  fields: {
    level: { type: 'enum', values: LOG_LEVELS, default: 'info' },
    fileEnabled: { type: 'boolean', default: true, key: 'file.enabled' },
    fileDir: { type: 'string', default: 'logs', minLength: 1, key: 'file.dir' },
    redact: { type: 'list', optional: true },
  },
  resolve: (values): LoggerConfig => ({
    level: values.level,
    file: { enabled: values.fileEnabled, dir: values.fileDir },
    redact: [...DEFAULT_REDACT_PATHS, ...(values.redact ?? [])],
  }),
});

export const loggerConfig = loggerDomain.token;
