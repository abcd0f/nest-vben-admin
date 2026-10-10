/**
 * 缓存值序列化与键拼接（纯函数，不依赖 ioredis，便于单测）。
 *
 * 序列化策略：**统一走 JSON**。
 * - 写：`JSON.stringify`。字符串会带上引号（`abc` → `"abc"`），
 *   这样 `"123"`（字符串）与 `123`（数字）在读取时不会互相混淆。
 * - 读：`JSON.parse`。Redis 返回 nil 表示键不存在，直接映射为 `null`。
 *
 * 已知边界（有意为之，不是 bug）：
 * - `undefined` 不能作为缓存值（无法序列化），要删除键请用 `del()`；
 * - `null` 会被写成字面量 `null`，读出来与「miss」无法区分，因此**不要缓存 `null`**；
 * - `Date` 会被 JSON 变成 ISO 字符串，需要类型保真请在业务层自行转换。
 */

/** 把任意可 JSON 化的值编码成字符串。`undefined` / function / symbol 会抛错。 */
export function encodeValue(value: unknown): string {
  if (value === undefined) {
    throw new Error('缓存值不能是 undefined：如需删除键请使用 del()');
  }

  let encoded: string | undefined;
  try {
    encoded = JSON.stringify(value);
  } catch (error) {
    throw new Error(`缓存值无法序列化为 JSON：${error instanceof Error ? error.message : String(error)}`);
  }

  if (encoded === undefined) {
    throw new Error('缓存值无法序列化：不支持 function / symbol 类型的值');
  }

  return encoded;
}

/** 把 Redis 返回的原始字符串解码。`null` 表示键不存在（miss）。 */
export function decodeValue<T>(raw: null | string): T | null {
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('缓存内容不是合法 JSON：该键可能被外部程序写入，或写入时的值类型已变更');
  }
}

/** 拼接命名空间前缀，避免与其他应用共用同一个 Redis 实例时键冲突。 */
export function buildCacheKey(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}
