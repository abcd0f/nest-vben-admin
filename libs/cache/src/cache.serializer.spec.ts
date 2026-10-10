import { buildCacheKey, decodeValue, encodeValue } from './cache.serializer.js';

describe('cacheSerializer', () => {
  describe('encodeValue', () => {
    it('把字符串编码为带引号的 JSON，避免与数字混淆', () => {
      expect(encodeValue('123')).toBe('"123"');
    });

    it('把数字编码为裸数字字面量', () => {
      expect(encodeValue(42)).toBe('42');
    });

    it('把对象编码为 JSON 字符串', () => {
      expect(encodeValue({ a: 1 })).toBe('{"a":1}');
    });

    it('把布尔值编码为 JSON 字面量', () => {
      expect(encodeValue(false)).toBe('false');
    });

    it('拒绝 undefined 并提示改用 del()', () => {
      expect(() => encodeValue(undefined)).toThrow(/del\(\)/);
    });

    it('拒绝无法序列化的 function', () => {
      expect(() => encodeValue(() => 1)).toThrow(/无法序列化/);
    });

    it('循环引用时抛出可读错误而不是原始 TypeError', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(() => encodeValue(circular)).toThrow(/无法序列化为 JSON/);
    });
  });

  describe('decodeValue', () => {
    it('把 nil 解码为 null，表示 miss', () => {
      expect(decodeValue(null)).toBeNull();
    });

    it('还原字符串，不会退化成数字', () => {
      expect(decodeValue<string>('"123"')).toBe('123');
    });

    it('还原对象', () => {
      expect(decodeValue<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    });

    it('兼容计数器写入的裸整数', () => {
      expect(decodeValue<number>('7')).toBe(7);
    });

    it('遇到非 JSON 内容抛出可读错误', () => {
      expect(() => decodeValue('not-json')).toThrow(/不是合法 JSON/);
    });
  });

  describe('buildCacheKey', () => {
    it('用冒号拼接命名空间前缀', () => {
      expect(buildCacheKey('cache', 'user:1')).toBe('cache:user:1');
    });
  });
});
