import type { ConfigSource, ConfigSourceValue, FieldLocator } from '../types.js';

/**
 * env 配置源：把「域 + 字段」映射到环境变量名，直接读快照里的值。
 *
 * env 里的值永远是字符串，类型转换由 core/fields.ts 负责。
 * 新增配置源时照抄这个文件的形状即可（见同目录 README 说明）。
 */
export function createEnvSource(raw: Record<string, unknown>): ConfigSource {
  const environment = typeof raw.NODE_ENV === 'string' ? raw.NODE_ENV : 'development';

  return {
    environment,
    read(locator: FieldLocator): ConfigSourceValue {
      return raw[locator.envKey];
    },
  };
}
