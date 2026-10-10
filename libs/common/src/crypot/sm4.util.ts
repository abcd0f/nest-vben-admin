import type { BytesLike, OutputEncoding, StringEncoding } from './bytes.util.js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { assertByteLength, bytesToString, toBytes } from './bytes.util.js';

/** SM4 工作模式。`ecb` 仅用于兼容既有协议，新代码请用 `cbc` 及以上 */
export type Sm4Mode = 'ecb' | 'cbc' | 'ctr' | 'cfb' | 'ofb';

/** SM4 分组与密钥长度固定为 16 字节（128 位） */
export const SM4_KEY_LENGTH = 16;

const SM4_IV_LENGTH = 16;
const STREAM_MODES: readonly Sm4Mode[] = ['ctr', 'cfb', 'ofb'];

/** 分组模式（需要 PKCS#7 填充）；流模式（ctr/cfb/ofb）不做填充 */
function isBlockMode(mode: Sm4Mode): boolean {
  return !STREAM_MODES.includes(mode);
}

/**
 * SM4 加解密选项。
 *
 * 默认使用 **CBC + PKCS#7 填充**：ECB 会泄漏明文分组结构（相同明文块产出相同密文块），
 * 除非对接的老系统只认 ECB，否则不要用它。
 */
export interface Sm4Options {
  /** 工作模式，默认 `cbc` */
  mode?: Sm4Mode;
  /** 自定义初始向量，16 字节；`ecb` 不需要。缺省则每次随机生成 */
  iv?: BytesLike;
  /** 字符串 IV 的编码，默认 `utf8` */
  ivEncoding?: StringEncoding;
  /** 字符串密钥的编码，默认 `utf8`；密钥必须为 16 字节 */
  keyEncoding?: StringEncoding;
  /** 明文字符串的编码，默认 `utf8` */
  textEncoding?: StringEncoding;
  /** 密文串（IV + 密文打包后）的编码，默认 `base64` */
  encoding?: OutputEncoding;
  /** 仅 `ecb` / `cbc`：是否使用 PKCS#7 填充，默认 `true`。关闭后明文长度必须是 16 的整数倍 */
  padding?: boolean;
}

/**
 * 打包格式（按 `encoding` 序列化前的原始字节布局）：
 *
 * ```
 * ecb:  ciphertext
 * 其余: iv(16) ‖ ciphertext
 * ```
 */
function resolveKey(key: BytesLike, options: Sm4Options): Buffer {
  const keyBuffer = toBytes(key, options.keyEncoding ?? 'utf8');
  assertByteLength(keyBuffer, SM4_KEY_LENGTH, 'SM4 密钥');
  return keyBuffer;
}

function resolveIv(options: Sm4Options, mode: Sm4Mode): Buffer | null {
  if (mode === 'ecb') {
    return null;
  }
  if (options.iv === undefined) {
    return randomBytes(SM4_IV_LENGTH);
  }
  const iv = toBytes(options.iv, options.ivEncoding ?? 'utf8');
  assertByteLength(iv, SM4_IV_LENGTH, 'SM4 IV');
  return iv;
}

/** 生成随机 SM4 密钥（16 字节）。 */
export function sm4GenerateKey(): Buffer {
  return randomBytes(SM4_KEY_LENGTH);
}

/**
 * SM4 加密，返回自包含的密文串（见文件头的打包格式说明）。
 *
 * @example
 * const secret = sm4Encrypt('hello', '0123456789abcdef');
 * sm4Decrypt(secret, '0123456789abcdef'); // 'hello'
 *
 * @example
 * // 对齐 GB/T 32907 标准向量：ECB + 关闭填充
 * sm4Encrypt(plaintextHex, keyHex, {
 *   mode: 'ecb', padding: false, keyEncoding: 'hex', textEncoding: 'hex', encoding: 'hex',
 * });
 */
export function sm4Encrypt(plaintext: string, key: BytesLike, options: Sm4Options = {}): string {
  const mode = options.mode ?? 'cbc';
  const keyBuffer = resolveKey(key, options);
  const iv = resolveIv(options, mode);

  const cipher = createCipheriv(`sm4-${mode}`, keyBuffer, iv);
  if (isBlockMode(mode)) {
    cipher.setAutoPadding(options.padding ?? true);
  }

  const plaintextBuffer = Buffer.from(plaintext, options.textEncoding ?? 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const packed = iv === null ? ciphertext : Buffer.concat([iv, ciphertext]);

  return bytesToString(packed, options.encoding ?? 'base64');
}

/** SM4 解密，与 {@link sm4Encrypt} 的参数保持一致。 */
export function sm4Decrypt(payload: string, key: BytesLike, options: Sm4Options = {}): string {
  const mode = options.mode ?? 'cbc';
  const keyBuffer = resolveKey(key, options);
  const ivLength = mode === 'ecb' ? 0 : SM4_IV_LENGTH;

  const raw = toBytes(payload, options.encoding ?? 'base64');
  if (raw.byteLength < ivLength) {
    throw new Error('SM4 密文格式不合法：长度不足以容纳 IV');
  }

  const iv = ivLength === 0 ? null : raw.subarray(0, ivLength);
  const ciphertext = raw.subarray(ivLength);

  const decipher = createDecipheriv(`sm4-${mode}`, keyBuffer, iv);
  if (isBlockMode(mode)) {
    decipher.setAutoPadding(options.padding ?? true);
  }

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString(options.textEncoding ?? 'utf8');
}
