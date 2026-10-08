import type { EnvSource } from './env.utils.js';
import { registerAs } from '@nestjs/config';
import {
  booleanValue,
  collectEnvValue,
  enumValue,
  optionalString,
  parseCsvList,
  stringValue,
  throwEnvErrors,
} from './env.utils.js';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevelName = (typeof LOG_LEVELS)[number];

export interface LoggerEnv {
  LOG_LEVEL: LogLevelName;
  LOG_FILE: boolean;
  LOG_DIR: string;
  LOG_REDACT?: string;
}

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

export function parseLoggerEnv(raw: EnvSource): LoggerEnv {
  const errors: string[] = [];
  const env = {
    LOG_LEVEL: collectEnvValue<LogLevelName>(errors, 'info', () => enumValue(raw, 'LOG_LEVEL', LOG_LEVELS, 'info')),
    LOG_FILE: collectEnvValue(errors, true, () => booleanValue(raw, 'LOG_FILE', true)),
    LOG_DIR: collectEnvValue(errors, 'logs', () => stringValue(raw, 'LOG_DIR', 'logs', 1)),
    LOG_REDACT: collectEnvValue(errors, undefined, () => optionalString(raw, 'LOG_REDACT')),
  };

  throwEnvErrors(errors);
  return env;
}

export function createLoggerConfig(env: LoggerEnv): LoggerConfig {
  return {
    level: env.LOG_LEVEL,
    file: { enabled: env.LOG_FILE, dir: env.LOG_DIR },
    redact: [...DEFAULT_REDACT_PATHS, ...parseCsvList(env.LOG_REDACT)],
  };
}

export const loggerConfig = registerAs('logger', (): LoggerConfig => createLoggerConfig(parseLoggerEnv(process.env)));
