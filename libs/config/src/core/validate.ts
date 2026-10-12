import type { AnyConfigDomain, ConfigSource } from './types.js';

/**
 * 遍历所有域收集错误，一次性抛出（fail-fast）。
 *
 * 错误输出格式与重构前的 `validateEnv` 完全一致：
 *   环境变量校验失败：
 *     - DATABASE_URL: 必填
 *     - CORS_MAX_AGE: 必须是非负整数
 */
export function validateConfigSource(domains: readonly AnyConfigDomain[], source: ConfigSource): void {
  const errors = domains.flatMap((domain) => domain.parse(source).errors);

  if (errors.length > 0) {
    throw new Error(`环境变量校验失败：\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  }
}
