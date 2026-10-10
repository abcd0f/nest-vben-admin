import { randomBytes as nodeRandomBytes } from 'node:crypto';

/**
 * 可接受的字节来源。
 *
 * 字符串按 `StringEncoding` 解释（默认 UTF-8）；其余按原始字节处理。
 */
export type BytesLike = string | Uint8Array | ArrayBuffer;

/** 字符串 → 字节 时使用的编码 */
export type StringEncoding = 'utf8' | 'hex' | 'base64' | 'base64url' | 'latin1';

/** 字节 → 字符串 时使用的编码（用于密文 / 摘要 / 签名等二进制结果的序列化） */
export type OutputEncoding = 'hex' | 'base64' | 'base64url';

/**
 * 把任意 `BytesLike` 归一化成 `Buffer`。
 *
 * - 字符串：按 `encoding` 解码（默认 UTF-8）；
 * - `Buffer`：原样返回（不拷贝）；
 * - `ArrayBuffer` / `Uint8Array`：零拷贝视图包装。
 */
export function toBytes(value: BytesLike, encoding: StringEncoding = 'utf8'): Buffer {
  if (typeof value === 'string') {
    return Buffer.from(value, encoding);
  }
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

/** 把字节序列化成字符串，默认 Base64。 */
export function bytesToString(bytes: Uint8Array, encoding: OutputEncoding = 'base64'): string {
  return Buffer.from(bytes).toString(encoding);
}

/** 把字符串编码成字节，默认 UTF-8（`toBytes` 的语义化别名）。 */
export function stringToBytes(text: string, encoding: StringEncoding = 'utf8'): Buffer {
  return Buffer.from(text, encoding);
}

/**
 * 断言字节长度符合预期，不符则抛出带上下文的中文错误。
 *
 * 加密算法对密钥 / IV 长度是硬约束（AES 密钥必须 16/24/32 字节、SM4 必须 16 字节），
 * 与其让底层 OpenSSL 抛出一句难以定位的英文错误，不如在入口就把话说清楚。
 *
 * @param bytes 待校验的字节
 * @param expected 允许的长度，单个数字或数组
 * @param name 用于错误信息的字段名（如「AES 密钥」）
 */
export function assertByteLength(bytes: Uint8Array, expected: number | readonly number[], name: string): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(bytes.byteLength)) {
    throw new Error(`${name}长度必须为 ${allowed.join(' / ')} 字节，实际为 ${bytes.byteLength} 字节`);
  }
}

/** 生成指定字节数的密码学安全随机数。 */
export function randomBytes(size: number): Buffer {
  return nodeRandomBytes(size);
}
