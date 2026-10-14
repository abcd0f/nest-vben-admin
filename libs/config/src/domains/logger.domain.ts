import { asBoolean, asEnum, asObject, asOptionalList, asString, defineConfigDomain } from '../core/index.js';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevelName = (typeof LOG_LEVELS)[number];

export interface LoggerFileConfig {
  enabled: boolean;
  dir: string;
}

export interface LoggerConfig {
  level: LogLevelName;
  file: LoggerFileConfig;
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

export const loggerDomain = defineConfigDomain<LoggerConfig>({
  namespace: 'logger',
  parse(raw): LoggerConfig {
    const value = asObject(raw, 'logger');
    const file = asObject(value.file, 'logger.file');
    return {
      level: asEnum(value.level, 'logger.level', LOG_LEVELS, 'info'),
      file: {
        enabled: asBoolean(file.enabled, 'logger.file.enabled', true),
        dir: asString(file.dir, 'logger.file.dir', 'logs'),
      },
      redact: [...DEFAULT_REDACT_PATHS, ...(asOptionalList(value.redact, 'logger.redact') ?? [])],
    };
  },
});

export const loggerConfig = loggerDomain.token;
