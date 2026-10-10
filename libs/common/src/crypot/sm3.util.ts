import type { BytesLike, OutputEncoding, StringEncoding } from './bytes.util.js';
import { createHash, createHmac } from 'node:crypto';
import { toBytes } from './bytes.util.js';

/** SM3 摘要选项 */
export interface Sm3Options {
  /** 字符串输入的编码，默认 `utf8` */
  textEncoding?: StringEncoding;
  /** 摘要串的编码，默认 `hex`（摘要惯例用十六进制） */
  encoding?: OutputEncoding;
}

/**
 * SM3 摘要（GB/T 32905-2016）。
 *
 * SM3 输出 256 位（64 个十六进制字符），用于替代 MD5 / SHA-1 做完整性校验或口令派生。
 * ⚠️ 摘要不可逆，**不要**用裸 SM3 存密码——口令哈希请用带盐、可调计算成本的算法
 * （如 `crypto.scrypt`）。
 *
 * @example
 * sm3('abc'); // '66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0'
 */
export function sm3(data: BytesLike, options: Sm3Options = {}): string {
  const buffer = toBytes(data, options.textEncoding ?? 'utf8');
  return createHash('sm3')
    .update(buffer)
    .digest(options.encoding ?? 'hex');
}

/** 生成 SM3 摘要的原始字节（便于继续做二进制处理）。 */
export function sm3Buffer(data: BytesLike, options: Pick<Sm3Options, 'textEncoding'> = {}): Buffer {
  const buffer = toBytes(data, options.textEncoding ?? 'utf8');
  return createHash('sm3').update(buffer).digest();
}

/**
 * HMAC-SM3，用于带密钥的消息认证（防篡改）。
 *
 * 密钥可以是任意长度的字符串或字节。
 */
export function hmacSm3(data: BytesLike, key: BytesLike, options: Sm3Options = {}): string {
  const dataBuffer = toBytes(data, options.textEncoding ?? 'utf8');
  const keyBuffer = toBytes(key, options.textEncoding ?? 'utf8');
  return createHmac('sm3', keyBuffer)
    .update(dataBuffer)
    .digest(options.encoding ?? 'hex');
}
