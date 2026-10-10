import type { CipherGCM, CipherGCMTypes, DecipherGCM } from 'node:crypto';
import type { BytesLike, OutputEncoding, StringEncoding } from './bytes.util.js';
import { createCipheriv, createDecipheriv, getCiphers, randomBytes } from 'node:crypto';
import { assertByteLength, bytesToString, toBytes } from './bytes.util.js';

/** AES 工作模式：`gcm` 为 AEAD（默认），`cbc` 为传统分组模式 */
export type AesMode = 'gcm' | 'cbc';

/** 允许的 AES 密钥长度（字节），分别对应 AES-128 / AES-192 / AES-256 */
export const AES_KEY_LENGTHS = [16, 24, 32] as const;

const GCM_IV_LENGTH = 12;
const CBC_IV_LENGTH = 16;
const DEFAULT_GCM_TAG_LENGTH = 16;

/**
 * AES 加解密选项。
 *
 * 密钥与 IV 都可以直接传 `Buffer` / `Uint8Array`；传字符串时按对应的
 * `keyEncoding` / `ivEncoding` 解码（默认 UTF-8）。
 */
export interface AesOptions {
  /** 工作模式，默认 `gcm`。GCM 自带完整性校验，除非要与既有系统互通，否则不要降级到 CBC */
  mode?: AesMode;
  /** 字符串密钥的编码，默认 `utf8`；密钥必须为 16 / 24 / 32 字节 */
  keyEncoding?: StringEncoding;
  /** 自定义初始向量；GCM 必须 12 字节、CBC 必须 16 字节。缺省则每次随机生成 */
  iv?: BytesLike;
  /** 字符串 IV 的编码，默认 `utf8` */
  ivEncoding?: StringEncoding;
  /** 密文串（IV + 认证标签 + 密文打包后）的编码，默认 `base64` */
  encoding?: OutputEncoding;
  /** 明文字符串的编码，默认 `utf8` */
  textEncoding?: StringEncoding;
  /** 仅 GCM：附加认证数据（AAD），加密与解密必须一致 */
  aad?: BytesLike;
  /** 仅 GCM：认证标签长度，默认 16 字节 */
  authTagLength?: number;
}

/**
 * 打包格式（先按 `encoding` 序列化前的原始字节布局）：
 *
 * ```
 * GCM:  iv(12) ‖ authTag(16) ‖ ciphertext
 * CBC:  iv(16) ‖ ciphertext
 * ```
 *
 * 这是一个「自包含」的布局——解密方只需要密文串与密钥，不必额外保存 IV。
 * 代价是**与第三方（如前端 crypto-js）互通时必须对齐该布局**：
 * crypto-js 的 `AES.encrypt` 默认只输出密文本身，需要对方自行把 IV 前置。
 */
function resolveAlgorithm(key: Buffer, mode: AesMode): string {
  return `aes-${key.byteLength * 8}-${mode}`;
}

function resolveKey(key: BytesLike, options: AesOptions): Buffer {
  const keyBuffer = toBytes(key, options.keyEncoding ?? 'utf8');
  assertByteLength(keyBuffer, AES_KEY_LENGTHS, 'AES 密钥');
  return keyBuffer;
}

function resolveIv(options: AesOptions, mode: AesMode): Buffer {
  const expected = mode === 'gcm' ? GCM_IV_LENGTH : CBC_IV_LENGTH;
  if (options.iv === undefined) {
    return randomBytes(expected);
  }
  const iv = toBytes(options.iv, options.ivEncoding ?? 'utf8');
  assertByteLength(iv, expected, `${mode.toUpperCase()} 模式的 IV`);
  return iv;
}

/** 生成随机 AES 密钥，`bits` 取 128 / 192 / 256，默认 256。 */
export function aesGenerateKey(bits: 128 | 192 | 256 = 256): Buffer {
  return randomBytes(bits / 8);
}

/**
 * 当前 Node 运行时是否支持指定的 AES 算法（正常情况下都支持，用于环境自检）。
 */
export function isAesSupported(mode: AesMode = 'gcm', bits: 128 | 192 | 256 = 256): boolean {
  return getCiphers().includes(`aes-${bits}-${mode}`);
}

/**
 * AES 加密，返回自包含的密文串（见文件头的打包格式说明）。
 *
 * @example
 * // 每次随机 IV，输出 Base64
 * const secret = aesEncrypt('hello', '0123456789abcdef'); // 16 字节密钥
 * aesDecrypt(secret, '0123456789abcdef'); // 'hello'
 *
 * @example
 * // 十六进制密钥 + AES-256-GCM + AAD
 * const secret = aesEncrypt('hello', hexKey, { keyEncoding: 'hex', aad: 'ctx' });
 */
export function aesEncrypt(plaintext: string, key: BytesLike, options: AesOptions = {}): string {
  const mode = options.mode ?? 'gcm';
  const keyBuffer = resolveKey(key, options);
  const iv = resolveIv(options, mode);
  const tagLength = options.authTagLength ?? DEFAULT_GCM_TAG_LENGTH;

  const cipher =
    mode === 'gcm'
      ? createCipheriv(resolveAlgorithm(keyBuffer, mode) as CipherGCMTypes, keyBuffer, iv, { authTagLength: tagLength })
      : createCipheriv(resolveAlgorithm(keyBuffer, mode), keyBuffer, iv);
  if (mode === 'gcm' && options.aad !== undefined) {
    (cipher as CipherGCM).setAAD(toBytes(options.aad));
  }

  const plaintextBuffer = Buffer.from(plaintext, options.textEncoding ?? 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const tag = mode === 'gcm' ? (cipher as CipherGCM).getAuthTag() : Buffer.alloc(0);

  return bytesToString(Buffer.concat([iv, tag, ciphertext]), options.encoding ?? 'base64');
}

/**
 * AES 解密。
 *
 * 使用 GCM 时，密文被篡改、AAD 不一致或密钥错误都会在 `final()` 处抛出
 * `Unsupported state or unable to authenticate data`——这是预期行为，不要吞掉它。
 */
export function aesDecrypt(payload: string, key: BytesLike, options: AesOptions = {}): string {
  const mode = options.mode ?? 'gcm';
  const keyBuffer = resolveKey(key, options);
  const ivLength = mode === 'gcm' ? GCM_IV_LENGTH : CBC_IV_LENGTH;
  const tagLength = mode === 'gcm' ? (options.authTagLength ?? DEFAULT_GCM_TAG_LENGTH) : 0;

  const raw = toBytes(payload, options.encoding ?? 'base64');
  if (raw.byteLength < ivLength + tagLength) {
    throw new Error('AES 密文格式不合法：长度不足以容纳 IV 与认证标签');
  }

  const iv = raw.subarray(0, ivLength);
  const tag = raw.subarray(ivLength, ivLength + tagLength);
  const ciphertext = raw.subarray(ivLength + tagLength);

  const decipher =
    mode === 'gcm'
      ? createDecipheriv(resolveAlgorithm(keyBuffer, mode) as CipherGCMTypes, keyBuffer, iv, {
          authTagLength: tagLength,
        })
      : createDecipheriv(resolveAlgorithm(keyBuffer, mode), keyBuffer, iv);
  if (mode === 'gcm') {
    const gcm = decipher as DecipherGCM;
    if (options.aad !== undefined) {
      gcm.setAAD(toBytes(options.aad));
    }
    gcm.setAuthTag(tag);
  }

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString(options.textEncoding ?? 'utf8');
}
