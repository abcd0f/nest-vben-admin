import { Inject, Injectable, Scope, type LoggerService, type LogLevel } from '@nestjs/common';
import type pino from 'pino';
import { PINO_LOGGER } from './logger.constants.js';

/** 结构化日志的附加字段 */
export type LogMeta = Record<string, unknown>;

type PinoLevelName = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Nest 的 LogLevel → pino 级别 */
const NEST_TO_PINO: Record<LogLevel, PinoLevelName> = {
  verbose: 'trace',
  debug: 'debug',
  log: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'fatal',
};

/** 由详细到简略，setLogLevels 取其中最宽松的一档 */
const LEVEL_ORDER: readonly PinoLevelName[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

interface ParsedParams {
  context?: string;
  stack?: string;
  error?: unknown;
  meta?: LogMeta;
}

/**
 * 解析 Nest / 业务两种调用约定。
 *
 * Nest 内部调用并不统一，实际会出现：
 *   logger.log(msg, context)
 *   logger.error(msg, stack, context)
 *   logger.error(msg, context)
 * 业务侧则是：logger.info(msg, meta) / logger.error(msg, error, meta)
 *
 * 统一规则：**最后一个字符串参数视为 context**（Nest 的约定），
 * 其余参数按类型归位——Error 进 err，字符串进 stack，对象并入 meta。
 */
function parseOptionalParams(optionalParams: unknown[]): ParsedParams {
  const rest = [...optionalParams];
  let context: string | undefined;

  const last = rest[rest.length - 1];
  if (typeof last === 'string') {
    context = rest.pop() as string;
  }

  let error: unknown;
  let stack: string | undefined;
  let meta: LogMeta | undefined;

  for (const value of rest) {
    if (value instanceof Error) {
      error = value;
    } else if (typeof value === 'string') {
      stack = value;
    } else if (value !== null && typeof value === 'object') {
      meta = { ...meta, ...(value as LogMeta) };
    }
  }

  return { context, stack, error, meta };
}

function toMessageText(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return message.message;
  }

  try {
    return JSON.stringify(message) ?? String(message);
  } catch {
    return String(message);
  }
}

/**
 * 日志门面。
 *
 * 设计要点：
 * 1. 只依赖 pino 一个包，不引入 nestjs-pino / pino-http。
 * 2. 实现 Nest 的 `LoggerService`，因此 `app.useLogger(app.get(AppLoggerService))`
 *    之后，框架自身日志和业务代码里的 `new Logger(Xxx.name)` 全部会落到这里 → 写进日志文件。
 * 3. `Scope.TRANSIENT`：每个注入点各自一份实例，`setContext()` 只影响自己。
 *    若用默认单例，多个 service 在构造函数里 setContext 会互相覆盖。
 *
 * 用法：
 *   constructor(private readonly logger: AppLoggerService) {
 *     this.logger.setContext(UserService.name);
 *   }
 *   this.logger.info('创建用户', { userId });
 *   this.logger.error('创建用户失败', error, { userId });
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context = 'Application';

  constructor(@Inject(PINO_LOGGER) private readonly logger: pino.Logger) {}

  /** 设置日志上下文；返回 this 便于链式调用 */
  setContext(context: string): this {
    this.context = context;
    return this;
  }

  // ---------- 业务侧推荐 API ----------

  trace(message: unknown, ...optionalParams: unknown[]): void {
    this.forward('trace', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.forward('debug', message, optionalParams);
  }

  info(message: unknown, ...optionalParams: unknown[]): void {
    this.forward('info', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.forward('warn', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.forward('error', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.forward('fatal', message, optionalParams);
  }

  // ---------- Nest LoggerService 契约 ----------

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.forward('info', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.forward('trace', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    const mapped = new Set(levels.map((level) => NEST_TO_PINO[level]));
    this.logger.level = LEVEL_ORDER.find((level) => mapped.has(level)) ?? 'info';
  }

  private forward(level: PinoLevelName, message: unknown, optionalParams: unknown[]): void {
    const { context, stack, error, meta } = parseOptionalParams(optionalParams);

    this.emit(level, context ?? this.context, message, { meta, error, stack });
  }

  private emit(
    level: PinoLevelName,
    context: string,
    message: unknown,
    extra: { meta?: LogMeta; error?: unknown; stack?: string } = {},
  ): void {
    const payload: Record<string, unknown> = { context };

    if (extra.meta) {
      Object.assign(payload, extra.meta);
    }

    if (extra.error !== undefined) {
      // pino 默认按 `err` 键做 Error 序列化（含 stack）。
      // 非 Error 统一包成 { message }，保证日志字段结构稳定、可检索。
      payload.err = extra.error instanceof Error ? extra.error : { message: String(extra.error) };
    }

    if (extra.stack !== undefined) {
      payload.stack = extra.stack;
    }

    const text = toMessageText(message);

    switch (level) {
      case 'trace':
        this.logger.trace(payload, text);
        break;
      case 'debug':
        this.logger.debug(payload, text);
        break;
      case 'info':
        this.logger.info(payload, text);
        break;
      case 'warn':
        this.logger.warn(payload, text);
        break;
      case 'error':
        this.logger.error(payload, text);
        break;
      case 'fatal':
        this.logger.fatal(payload, text);
        break;
    }
  }
}
