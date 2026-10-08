import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import pino from 'pino';
import type { LoggerConfig } from './logger.config.js';

/** pino DestinationStream 的最小契约 + 刷盘 / 关闭能力 */
export interface RotatingFileStream {
  write(chunk: string): void;
  flushSync(): void;
  close(): void;
}

/** 本地日期 → YYYY-MM-DD，用作日志文件名的日期段 */
export function formatLogDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 本地时间 + 时区偏移，如 `2026-10-08T13:30:17.278+08:00`。
 *
 * 为什么不用 pino 内置的 `isoTime`：它输出 UTC，而日志文件名用的是**本地**日期，
 * 两者会错位——凌晨 00:30（UTC+8）写进 `app-<本地日期>.log` 的行会显示成前一天的时间。
 * 带上偏移量既保持本地可读，又没有歧义。
 */
export function formatLocalIso(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);

  return `${shifted.toISOString().slice(0, 23)}${offset}`;
}

/** 传给 pino 的 `timestamp` 选项：需要自己拼出 `,"time":"..."` 片段 */
export function localIsoTimestamp(): string {
  return `,"time":"${formatLocalIso(new Date())}"`;
}

/**
 * 按天切分的文件流：写入时发现日期变化，就关掉旧文件、打开新文件。
 *
 * 为什么自己写：pino 自带的 `pino/file` 不做轮转，而按天切分是避免单个日志文件
 * 无限增长的最低要求。不引第三方包（pino-roll / rotating-file-stream）的代价就是这几十行。
 */
export function createDailyRotatingStream(options: {
  dir: string;
  prefix: string;
  now?: () => Date;
}): RotatingFileStream {
  const now = options.now ?? (() => new Date());
  let currentDate = '';
  let destination: ReturnType<typeof pino.destination> | undefined;

  const ensureDestination = (): ReturnType<typeof pino.destination> => {
    const date = formatLogDate(now());

    if (!destination || date !== currentDate) {
      // 换文件前先把旧文件的缓冲刷掉，否则最后几条会丢
      destination?.flushSync();
      destination?.end();

      mkdirSync(options.dir, { recursive: true });
      destination = pino.destination({
        dest: join(options.dir, `${options.prefix}-${date}.log`),
        // sync: true —— 同步写入。
        //
        // 代价：每条日志一次 writeSync，会阻塞事件循环。
        // 收益：
        //   1. fd 同步打开，flushSync() 随时可调。异步模式（sync: false）下 fd 是异步打开的，
        //      未就绪时调 flushSync() 会抛 "sonic boom is not ready yet"。
        //   2. 进程崩溃不丢日志。
        // 若将来日志量压不住，再换 sync: false + 监听 'ready' 事件做就绪判断。
        sync: true,
      });
      currentDate = date;
    }

    return destination;
  };

  return {
    write: (chunk) => ensureDestination().write(chunk),
    flushSync: () => destination?.flushSync(),
    close: () => {
      destination?.flushSync();
      destination?.end();
      destination = undefined;
      currentDate = '';
    },
  };
}

export interface LoggerStreams {
  stream: pino.MultiStreamRes<pino.LevelWithSilent>;
  /** 进程退出前调用：刷盘并释放文件句柄 */
  close(): void;
}

/**
 * 组装日志出口：只写文件。
 *
 * 控制台不在这里——控制台输出由 Nest 自带的 ConsoleLogger 负责，保持原有样式，
 * pino 的唯一职责是把日志落到文件。
 *
 * 全量与错误分成两个文件，是为了线上排查时不用在几 GB 的全量日志里 grep。
 */
export function createLoggerStreams(config: LoggerConfig): LoggerStreams {
  const files: RotatingFileStream[] = [];
  const entries: pino.StreamEntry<pino.LevelWithSilent>[] = [];
  const level = config.level as pino.LevelWithSilent;

  if (config.file.enabled) {
    const appFile = createDailyRotatingStream({ dir: config.file.dir, prefix: 'app' });
    const errorFile = createDailyRotatingStream({ dir: config.file.dir, prefix: 'error' });
    files.push(appFile, errorFile);

    // 全量日志
    entries.push({ level, stream: appFile });
    // 错误日志单独一份
    entries.push({ level: 'error', stream: errorFile });
  }

  // LOG_FILE=false 时 entries 为空，pino 就是一个不落任何地方的 no-op
  return {
    stream: pino.multistream<pino.LevelWithSilent>(entries),
    close: () => files.forEach((file) => file.close()),
  };
}
