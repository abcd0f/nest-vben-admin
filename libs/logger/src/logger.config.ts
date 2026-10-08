import type { ConfigService } from '@nestjs/config';

export interface LoggerFileConfig {
  enabled: boolean;
  dir: string;
}

export interface LoggerConfig {
  /** pino 级别：fatal | error | warn | info | debug | trace | silent */
  level: string;
  file: LoggerFileConfig;
  /** 需要脱敏的字段路径 */
  redact: string[];
}

/**
 * 默认脱敏路径。
 *
 * 这是安全底线，不是可选项：登录接口的请求体、鉴权头、Cookie 一旦进日志文件，
 * 就等于把凭据写进了磁盘。宁可少记，不可泄漏。
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

/**
 * 从 ConfigService 解析日志配置（纯函数，便于单测）。
 *
 * 注意：这里没有「输出到控制台」的开关——pino 只负责写日志文件，
 * 控制台输出由 Nest 自带的 ConsoleLogger 负责，样式不受本模块影响。
 */
export function resolveLoggerConfig(config: ConfigService): LoggerConfig {
  const extraRedact = (config.get<string>('LOG_REDACT') ?? '')
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);

  return {
    level: config.get<string>('LOG_LEVEL', 'info'),
    file: {
      enabled: config.get<boolean>('LOG_FILE', true),
      dir: config.get<string>('LOG_DIR', 'logs'),
    },
    redact: [...DEFAULT_REDACT_PATHS, ...extraRedact],
  };
}
