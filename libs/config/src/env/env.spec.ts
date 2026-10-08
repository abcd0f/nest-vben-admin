import { envSchema } from './env.schema.js';
import { validateEnv } from './env.validation.js';
import { booleanEnv, parseCsvList } from './env.utils.js';

const VALID_DATABASE_URL = 'postgresql://u:p@h:5432/db';

describe('env.utils', () => {
  describe('booleanEnv', () => {
    it('把字面量 true / false 转成布尔值', () => {
      expect(booleanEnv('false').parse('true')).toBe(true);
      expect(booleanEnv('true').parse('false')).toBe(false);
    });

    it('缺省时用默认值', () => {
      expect(booleanEnv('true').parse(undefined)).toBe(true);
      expect(booleanEnv('false').parse(undefined)).toBe(false);
    });

    it('拒绝 true/false 之外的写法 —— 避免 Boolean("false") === true 的经典坑', () => {
      expect(() => booleanEnv().parse('1')).toThrow();
      expect(() => booleanEnv().parse('yes')).toThrow();
    });
  });

  describe('parseCsvList', () => {
    it('去空白、丢空项', () => {
      expect(parseCsvList('a, b ,, ')).toEqual(['a', 'b']);
    });

    it('undefined 返回空数组', () => {
      expect(parseCsvList(undefined)).toEqual([]);
    });
  });
});

describe('validateEnv', () => {
  it('通过时返回转换后的值（而不是原始字符串）', () => {
    const env = validateEnv({ DATABASE_URL: VALID_DATABASE_URL, LOG_FILE: 'false', PORT: '8080' });

    expect(env.PORT).toBe(8080);
    expect(env.LOG_FILE).toBe(false);
    expect(env.DATABASE_POOL_MAX).toBe(10);
  });

  it('缺少必填项时抛错，并在信息里点出字段名', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('枚举值写错时抛错', () => {
    expect(() => validateEnv({ DATABASE_URL: VALID_DATABASE_URL, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });

  it('校验的是「各配置域 schema 的汇总」，任一域写错都会拦下', () => {
    expect(() => validateEnv({ DATABASE_URL: VALID_DATABASE_URL, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => validateEnv({ DATABASE_URL: VALID_DATABASE_URL, DATABASE_POOL_MAX: '0' })).toThrow(
      /DATABASE_POOL_MAX/,
    );
  });

  it('汇总 schema 覆盖了全部三个配置域的变量', () => {
    const keys = Object.keys(envSchema.shape);

    expect(keys).toContain('NODE_ENV');
    expect(keys).toContain('DATABASE_URL');
    expect(keys).toContain('LOG_LEVEL');
  });
});
