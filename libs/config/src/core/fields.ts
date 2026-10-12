import type { FieldSpec } from './types.js';

function fail(key: string, reason: string): Error {
  return new Error(`${key}: ${reason}`);
}

function isAbsent(raw: unknown): boolean {
  return raw === undefined || raw === null;
}

/** `a,b , c` → `['a', 'b', 'c']` */
function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 解析单个字段。
 *
 * 成功返回解析后的值；失败抛出 `${配置键}: ${原因}` 形式的错误 ——
 * 键名用点分路径（如 `database.pool.max`），和配置文件里写的完全一致，便于定位。
 *
 * 取值对 YAML 的原生类型友好：布尔接受 true/false 与 "true"/"false"，
 * 数字接受 number 与数字字符串，字符串接受 string 与 number（避免 `password: 123456` 被 YAML 解析成数字后报错）。
 */
export function parseField(key: string, spec: FieldSpec, raw: unknown): unknown {
  const absent = isAbsent(raw);

  switch (spec.type) {
    case 'boolean': {
      if (absent) {
        if (spec.default !== undefined) return spec.default;
        if (spec.optional === true) return undefined;
        throw fail(key, '必填');
      }
      if (raw === true || raw === 'true') return true;
      if (raw === false || raw === 'false') return false;
      throw fail(key, '只能是 true 或 false');
    }

    case 'enum': {
      if (absent) {
        if (spec.default !== undefined) return spec.default;
        if (spec.optional === true) return undefined;
        throw fail(key, `必须是以下值之一：${spec.values.join(', ')}`);
      }
      if (typeof raw !== 'string' || !spec.values.includes(raw)) {
        throw fail(key, `必须是以下值之一：${spec.values.join(', ')}`);
      }
      return raw;
    }

    case 'integer': {
      if (absent) return spec.default;

      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isInteger(value) || value < spec.min) {
        throw fail(key, spec.min > 0 ? `必须是大于等于 ${spec.min} 的整数` : '必须是非负整数');
      }
      return value;
    }

    case 'list': {
      if (absent) {
        if (spec.default !== undefined) return [...spec.default];
        if (spec.optional === true) return undefined;
        throw fail(key, '必填');
      }

      let items: string[];
      if (Array.isArray(raw)) {
        if (raw.some((item) => typeof item !== 'string' && typeof item !== 'number')) {
          throw fail(key, '数组元素必须是字符串');
        }
        items = raw.map((item) => String(item).trim()).filter(Boolean);
      } else if (typeof raw === 'string') {
        items = splitCsv(raw);
      } else {
        throw fail(key, '必须是数组或逗号分隔的字符串');
      }

      if (items.length === 0) {
        if (spec.optional === true) return undefined;
        throw fail(key, '不能为空');
      }
      return items;
    }

    case 'string': {
      if (absent) {
        if (spec.default !== undefined) return spec.default;
        if (spec.optional === true) return undefined;
        throw fail(key, '必填');
      }
      if (typeof raw !== 'string' && typeof raw !== 'number') {
        throw fail(key, '必须是字符串');
      }

      const value = typeof raw === 'string' ? raw : String(raw);
      const normalized = spec.trim === true ? value.trim() : value;
      if (spec.optional === true && normalized === '') return undefined;

      const minLength = spec.minLength ?? 0;
      if (normalized.length < minLength) throw fail(key, `长度至少为 ${minLength}`);
      return normalized;
    }
  }
}
