import type { FieldSpec } from './types.js';

/** `a,b , c` → `['a', 'b', 'c']` */
export function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function fail(envKey: string, reason: string): Error {
  return new Error(`${envKey}: ${reason}`);
}

function isAbsent(raw: unknown): boolean {
  return raw === undefined || raw === null;
}

/**
 * 解析单个字段。
 *
 * 成功返回解析后的值；失败抛出 `${envKey}: ${原因}` 形式的错误 ——
 * 文案与重构前的 `stringValue` / `integerValue` 等工具函数逐字一致，
 * 保证校验失败的输出不变。
 */
export function parseField(envKey: string, spec: FieldSpec, raw: unknown): unknown {
  const absent = isAbsent(raw);

  switch (spec.type) {
    case 'boolean': {
      if (absent) return spec.default;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      throw fail(envKey, '只能是 true 或 false');
    }

    case 'csv': {
      if (absent) {
        if (spec.default !== undefined) return splitCsv(spec.default);
        if (spec.optional === true) return undefined;
        throw fail(envKey, '必填');
      }
      if (typeof raw !== 'string') throw fail(envKey, '必须是字符串');

      const value = raw.trim();
      if (value === '') {
        if (spec.optional === true) return undefined;
        throw fail(envKey, '不能为空');
      }
      return splitCsv(value);
    }

    case 'enum': {
      if (absent) {
        if (spec.default !== undefined) return spec.default;
        if (spec.optional === true) return undefined;
        throw fail(envKey, `必须是以下值之一：${spec.values.join(', ')}`);
      }
      if (typeof raw !== 'string' || !spec.values.includes(raw)) {
        throw fail(envKey, `必须是以下值之一：${spec.values.join(', ')}`);
      }
      return raw;
    }

    case 'integer': {
      if (absent) return spec.default;

      const value = Number(raw);
      if (!Number.isInteger(value) || value < spec.min) {
        throw fail(envKey, spec.min > 0 ? `必须是大于等于 ${spec.min} 的整数` : '必须是非负整数');
      }
      return value;
    }

    case 'string': {
      if (absent) {
        if (spec.default !== undefined) return spec.default;
        if (spec.optional === true) return undefined;
        throw fail(envKey, '必填');
      }
      if (typeof raw !== 'string') throw fail(envKey, '必须是字符串');

      const value = spec.trim === true ? raw.trim() : raw;
      if (spec.optional === true && value === '') return undefined;

      const minLength = spec.minLength ?? 0;
      if (value.length < minLength) throw fail(envKey, `长度至少为 ${minLength}`);
      return value;
    }
  }
}
