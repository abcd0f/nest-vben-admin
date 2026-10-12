import type { ConfigSource, ConfigSourceValue, FieldLocator } from '../types.js';

/** 按路径取值：`['database', 'pool', 'max']` → `raw.database.pool.max`，中途遇到非对象即视为缺失 */
function readPath(raw: Record<string, unknown>, path: readonly string[]): ConfigSourceValue {
  let cursor: unknown = raw;

  for (const segment of path) {
    if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * YAML 配置源：把「域 + 字段」映射到键路径，直接读合并后的对象。
 *
 * 类型转换与校验由 core/fields.ts 负责，这里只负责定位与取值。
 */
export function createYamlSource(raw: Record<string, unknown>, environment: ConfigSource['environment']): ConfigSource {
  return {
    environment,
    read(locator: FieldLocator): ConfigSourceValue {
      return readPath(raw, locator.path);
    },
  };
}
