import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { booleanEnv, parseCsvList } from '../env/env.utils.js';

/** 日志环境变量契约 */
export const loggerEnvSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_FILE: booleanEnv('true'),
  LOG_DIR: z.string().min(1).default('logs'),
  LOG_REDACT: z.string().optional(),
});

export type LogLevelName = z.infer<typeof loggerEnvSchema>['LOG_LEVEL'];

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

/**
 * 默认脱敏路径。
 *
 * 这是安全底线，不是可选项：登录接口的请求体、鉴权头、Cookie 一旦进日志文件，
 * 就等于把凭据写进了磁盘。宁可少记，不可泄漏。
 * 需要追加时用 `LOG_REDACT` 环境变量（逗号分隔），不要改这里。
 */
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

/** 日志配置。工厂只读 process.env，理由见 app.config.ts 的注释。 */
export const loggerConfig = registerAs('logger', (): LoggerConfig => {
  const env = loggerEnvSchema.parse(process.env);

  return {
    level: env.LOG_LEVEL,
    file: {
      enabled: env.LOG_FILE,
      dir: env.LOG_DIR,
    },
    redact: [...DEFAULT_REDACT_PATHS, ...parseCsvList(env.LOG_REDACT)],
  };
});
