import { Test, TestingModule } from '@nestjs/testing';
import { PINO_LOGGER } from './logger.constants.js';
import { AppLoggerService } from './logger.service.js';

describe('appLoggerService', () => {
  let service: AppLoggerService;

  const pinoMock = {
    level: 'info',
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    pinoMock.level = 'info';

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppLoggerService, { provide: PINO_LOGGER, useValue: pinoMock }],
    }).compile();

    // AppLoggerService 是 TRANSIENT scope，不能用 module.get()，必须 resolve()
    service = await module.resolve<AppLoggerService>(AppLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('默认 context 为 Application', () => {
    service.info('hello');

    expect(pinoMock.info).toHaveBeenCalledWith({ context: 'Application' }, 'hello');
  });

  it('setContext 可链式调用，并写入日志字段', () => {
    service.setContext('UserService').info('created', { userId: 'u1' });

    expect(pinoMock.info).toHaveBeenCalledWith({ context: 'UserService', userId: 'u1' }, 'created');
  });

  it('各等级方法各自落到对应的 pino 方法', () => {
    service.setContext('X').trace('t');
    service.setContext('X').debug('d');
    service.setContext('X').warn('w');
    service.setContext('X').fatal('f');

    expect(pinoMock.trace).toHaveBeenCalledWith({ context: 'X' }, 't');
    expect(pinoMock.debug).toHaveBeenCalledWith({ context: 'X' }, 'd');
    expect(pinoMock.warn).toHaveBeenCalledWith({ context: 'X' }, 'w');
    expect(pinoMock.fatal).toHaveBeenCalledWith({ context: 'X' }, 'f');
  });

  describe('error', () => {
    it('把 Error 实例放进 err 字段（交给 pino 序列化 stack）', () => {
      const error = new Error('boom');
      service.setContext('X').error('failed', error, { a: 1 });

      expect(pinoMock.error).toHaveBeenCalledWith({ context: 'X', a: 1, err: error }, 'failed');
    });

    it('兼容 Nest 的 error(msg, stack, context) 契约', () => {
      service.error('boom', 'Error: boom\n    at x', 'ExceptionFilter');

      expect(pinoMock.error).toHaveBeenCalledWith(
        { context: 'ExceptionFilter', stack: 'Error: boom\n    at x' },
        'boom',
      );
    });

    it('兼容 Nest 的 error(msg, context) 契约', () => {
      service.error('boom', 'ExceptionFilter');

      expect(pinoMock.error).toHaveBeenCalledWith({ context: 'ExceptionFilter' }, 'boom');
    });

    it('业务侧第二个参数请传 Error：字符串会被按 Nest 约定当成 context', () => {
      service.error('failed', 'SomeService');

      expect(pinoMock.error).toHaveBeenCalledWith({ context: 'SomeService' }, 'failed');
    });

    it('未传 error 时不应出现 err 字段', () => {
      service.error('failed');

      expect(pinoMock.error).toHaveBeenCalledWith({ context: 'Application' }, 'failed');
    });
  });

  describe('Nest LoggerService 契约', () => {
    it('log(msg, context) 走 info 级别', () => {
      service.log('booted', 'NestFactory');

      expect(pinoMock.info).toHaveBeenCalledWith({ context: 'NestFactory' }, 'booted');
    });

    it('verbose 走 trace 级别', () => {
      service.verbose('detail', 'X');

      expect(pinoMock.trace).toHaveBeenCalledWith({ context: 'X' }, 'detail');
    });

    it('非字符串 message 会被安全序列化', () => {
      service.info({ foo: 'bar' });

      expect(pinoMock.info).toHaveBeenCalledWith({ context: 'Application' }, '{"foo":"bar"}');
    });

    it('setLogLevels 取最宽松的一档', () => {
      service.setLogLevels(['error', 'warn', 'log', 'debug']);

      expect(pinoMock.level).toBe('debug');
    });

    it('setLogLevels 只有 error/fatal 时收敛到 error', () => {
      service.setLogLevels(['error', 'fatal']);

      expect(pinoMock.level).toBe('error');
    });
  });
});
