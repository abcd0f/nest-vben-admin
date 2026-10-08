import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDailyRotatingStream, formatLocalIso, formatLogDate, localIsoTimestamp } from './logger.streams.js';

describe('loggerStreams', () => {
  describe('formatLogDate', () => {
    it('月/日补零成 YYYY-MM-DD', () => {
      expect(formatLogDate(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(formatLogDate(new Date(2026, 11, 31))).toBe('2026-12-31');
      expect(formatLogDate(new Date(2026, 9, 8))).toBe('2026-10-08');
    });
  });

  describe('formatLocalIso', () => {
    it('输出本地时间并带时区偏移（不受运行机器时区影响）', () => {
      expect(formatLocalIso(new Date(2026, 0, 5, 13, 30, 17, 278))).toMatch(
        /^2026-01-05T13:30:17\.278[+-]\d{2}:\d{2}$/,
      );
    });

    it('localIsoTimestamp 拼成 pino 需要的 ,"time":"..." 片段', () => {
      expect(localIsoTimestamp()).toMatch(/^,"time":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}"$/);
    });
  });

  describe('createDailyRotatingStream', () => {
    it('跨天时自动切到新文件，且不丢内容', () => {
      const dir = mkdtempSync(join(tmpdir(), 'app-logger-'));
      let now = new Date(2026, 0, 1, 23, 59);

      const stream = createDailyRotatingStream({ dir, prefix: 'app', now: () => now });

      stream.write('{"day":1}\n');

      now = new Date(2026, 0, 2, 0, 1);
      stream.write('{"day":2}\n');

      stream.flushSync();

      expect(readdirSync(dir).sort()).toEqual(['app-2026-01-01.log', 'app-2026-01-02.log']);
      expect(readFileSync(join(dir, 'app-2026-01-01.log'), 'utf8')).toBe('{"day":1}\n');
      expect(readFileSync(join(dir, 'app-2026-01-02.log'), 'utf8')).toBe('{"day":2}\n');

      stream.close();

      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows 上句柄释放可能滞后，删不掉就交给系统临时目录回收
      }
    });

    it('同一天内多次写入落在同一个文件', () => {
      const dir = mkdtempSync(join(tmpdir(), 'app-logger-'));
      const now = new Date(2026, 5, 15, 10, 0);
      const stream = createDailyRotatingStream({ dir, prefix: 'error', now: () => now });

      stream.write('a\n');
      stream.write('b\n');
      stream.flushSync();

      expect(readdirSync(dir)).toEqual(['error-2026-06-15.log']);
      expect(readFileSync(join(dir, 'error-2026-06-15.log'), 'utf8')).toBe('a\nb\n');

      stream.close();

      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // 同上
      }
    });
  });
});
