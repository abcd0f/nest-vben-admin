import { z } from 'zod';

/**
 * 布尔型环境变量。
 *
 * 为什么不用 `z.coerce.boolean()`：`Boolean('false') === true`，
 * 环境变量里写 `LOG_FILE=false` 会被解析成 true，这是个经典陷阱。
 * 这里只接受字面量 'true' / 'false'，写错直接启动失败。
 */
export function booleanEnv(defaultValue: 'true' | 'false' = 'false') {
  return z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');
}

/**
 * 逗号分隔的环境变量 → 字符串数组：去空白、丢空项。
 * 环境变量里表达列表只能用字符串，统一在这里处理，避免每个域各写一遍。
 */
export function parseCsvList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
