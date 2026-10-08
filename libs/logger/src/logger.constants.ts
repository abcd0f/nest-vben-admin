/** DI 令牌：pino 实例 */
export const PINO_LOGGER = Symbol('PINO_LOGGER');

/** DI 令牌：日志目标流（用于进程退出前刷盘） */
export const LOGGER_STREAMS = Symbol('LOGGER_STREAMS');
