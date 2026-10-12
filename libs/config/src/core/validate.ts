import type { AnyConfigDomain, ConfigSource } from './types.js';

/**
 * 遍历所有域收集错误，一次性抛出（fail-fast）。
 *
 * 输出格式：
 *   配置校验失败：
 *     - database.url: 必填
 *     - cors.max-age: 必须是非负整数
 */
export function validateConfigSource(domains: readonly AnyConfigDomain[], source: ConfigSource): void {
  const errors = domains.flatMap((domain) => domain.parse(source).errors);

  if (errors.length > 0) {
    throw new Error(`配置校验失败：\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  }
}
