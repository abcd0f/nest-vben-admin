import { Global, Inject, Injectable, Module, type DynamicModule, type OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import pino from 'pino';
import { LOGGER_STREAMS, PINO_LOGGER } from './logger.constants.js';
import { resolveLoggerConfig } from './logger.config.js';
import { RequestLogInterceptor } from './logger.interceptor.js';
import { AppLoggerService } from './logger.service.js';
import { createLoggerStreams, localIsoTimestamp, type LoggerStreams } from './logger.streams.js';

/**
 * 进程退出前把 pino 的异步缓冲刷到磁盘。
 *
 * 为什么不能只调 `logger.flush()`：pino 的 flush 只认目标流上的 `flush` 方法，
 * 而 `pino.multistream()` 返回的对象只提供 `flushSync`——实测 `logger.flush()` 会直接空转，
 * 最后几条日志会丢。所以这里自己持有流引用。
 */
@Injectable()
class LoggerLifecycle implements OnModuleDestroy {
  constructor(@Inject(LOGGER_STREAMS) private readonly streams: LoggerStreams) {}

  onModuleDestroy(): void {
    this.streams.close();
  }
}

/**
 * 全局日志模块（只用 pino 一个包）。
 *
 * 职责边界：**只负责写日志文件**。
 * - `logs/app-YYYY-MM-DD.log`   全量
 * - `logs/error-YYYY-MM-DD.log` 仅 error 及以上
 *
 * 控制台输出不经过本模块——仍由 Nest 自带的 ConsoleLogger 负责，样式不受影响，
 * 因此这里**不调用** app.useLogger()。若将来想把框架自身日志也落文件，
 * 在 main.ts 加一行即可（AppLoggerService 已实现 Nest 的 LoggerService 契约）：
 *   app.useLogger(await app.resolve(AppLoggerService));
 *
 * 用法（业务模块无需 import，本模块已标 @Global）：
 *   constructor(private readonly logger: AppLoggerService) {
 *     this.logger.setContext(XxxService.name);
 *   }
 */
@Global()
@Module({})
export class AppLoggerModule {
  static forRoot(): DynamicModule {
    return {
      module: AppLoggerModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: LOGGER_STREAMS,
          useFactory: (config: ConfigService) => createLoggerStreams(resolveLoggerConfig(config)),
          inject: [ConfigService],
        },
        {
          provide: PINO_LOGGER,
          useFactory: (config: ConfigService, streams: LoggerStreams) => {
            const { level, redact } = resolveLoggerConfig(config);

            return pino(
              {
                level,
                redact: { paths: redact, censor: '[REDACTED]' },
                // 本地时间 + 时区偏移，与按本地日期命名的日志文件保持一致
                timestamp: localIsoTimestamp,
              },
              streams.stream,
            );
          },
          inject: [ConfigService, LOGGER_STREAMS],
        },
        AppLoggerService,
        LoggerLifecycle,
        { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
      ],
      exports: [AppLoggerService],
    };
  }
}
