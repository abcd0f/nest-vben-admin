import type { BytesLike, OutputEncoding, StringEncoding } from './bytes.util.js';
import {
  constants,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
  privateDecrypt,
  publicEncrypt,
  sign,
  verify,
} from 'node:crypto';
import { bytesToString, toBytes } from './bytes.util.js';

/** RSA 密钥输入：PEM 字符串、DER 字节或已解析的 `KeyObject` */
export type RsaKeyInput = string | Uint8Array | KeyObject;

/** RSA 填充方案：`oaep` 为推荐值，`pkcs1`（v1.5）用于对接老系统 */
export type RsaPadding = 'oaep' | 'pkcs1';

/** 签名填充方案：`pkcs1` 对应 RS256（互通性最好），`pss` 为更安全的概率签名 */
export type RsaSignPadding = 'pkcs1' | 'pss';

/** RSA 可用的摘要算法 */
export type RsaHash = 'sha1' | 'sha256' | 'sha384' | 'sha512';

const HASH_LENGTHS: Record<RsaHash, number> = { sha1: 20, sha256: 32, sha384: 48, sha512: 64 };

/** 密钥对生成选项 */
export interface RsaKeyPairOptions {
  /** 模长（位），默认 2048；新系统建议不低于 2048，长期存储建议 3072 及以上 */
  modulusLength?: number;
  /** 公钥格式，默认 `spki` */
  publicKeyType?: 'spki' | 'pkcs1';
  /** 私钥格式，默认 `pkcs8`（PKCS#1 仅供老旧系统） */
  privateKeyType?: 'pkcs8' | 'pkcs1';
  /** 私钥加密口令；提供后私钥 PEM 会以加密形式输出 */
  passphrase?: string;
  /** 私钥加密算法，默认 `aes-256-cbc`（仅在提供 `passphrase` 时生效） */
  cipher?: string;
}

/** PEM 编码的 RSA 密钥对 */
export interface RsaKeyPair {
  publicKey: string;
  privateKey: string;
}

/** RSA 加密选项 */
export interface RsaEncryptOptions {
  /** 填充方案，默认 `oaep` */
  padding?: RsaPadding;
  /** 仅 OAEP：摘要算法，默认 `sha256` */
  oaepHash?: RsaHash;
  /** 明文（字符串）编码，默认 `utf8` */
  textEncoding?: StringEncoding;
  /** 密文串编码，默认 `base64` */
  encoding?: OutputEncoding;
}

/** RSA 解密选项 */
export interface RsaDecryptOptions extends RsaEncryptOptions {
  /** 私钥口令（私钥为加密 PEM 时需要） */
  passphrase?: string;
}

/** RSA 签名选项 */
export interface RsaSignOptions {
  /** 摘要算法，默认 `sha256` */
  hash?: RsaHash;
  /** 填充方案，默认 `pkcs1`（RS256） */
  padding?: RsaSignPadding;
  /** 仅 PSS：盐长度，默认与摘要等长 */
  saltLength?: number;
  /** 私钥口令（私钥为加密 PEM 时需要） */
  passphrase?: string;
  /** 消息（字符串）编码，默认 `utf8` */
  textEncoding?: StringEncoding;
  /** 签名串编码，默认 `base64` */
  encoding?: OutputEncoding;
}

/** RSA 验签选项 */
export interface RsaVerifyOptions extends Omit<RsaSignOptions, 'passphrase'> {
  /** 公钥口令（一般用不到，保留以对齐签名接口） */
  passphrase?: string;
}

function asKeyObject(input: RsaKeyInput, kind: 'public' | 'private', passphrase?: string): KeyObject {
  if (input instanceof KeyObject) {
    return input;
  }
  const material = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  if (kind === 'public') {
    return createPublicKey(material);
  }
  return passphrase === undefined ? createPrivateKey(material) : createPrivateKey({ key: material, passphrase });
}

function resolvePadding(padding: RsaPadding | undefined): number {
  return padding === 'pkcs1' ? constants.RSA_PKCS1_PADDING : constants.RSA_PKCS1_OAEP_PADDING;
}

function resolveSignPadding(padding: RsaSignPadding | undefined): number {
  return padding === 'pss' ? constants.RSA_PKCS1_PSS_PADDING : constants.RSA_PKCS1_PADDING;
}

/**
 * 生成 RSA 密钥对（默认 2048 位，PEM / PKCS#8）。
 *
 * 生成 2048 位密钥约需数十到数百毫秒，属于**同步阻塞**操作——不要放在请求热路径上，
 * 应在启动或初始化阶段完成。
 *
 * @example
 * const { publicKey, privateKey } = generateRsaKeyPair();
 */
export function generateRsaKeyPair(options: RsaKeyPairOptions = {}): RsaKeyPair {
  const {
    modulusLength = 2048,
    publicKeyType = 'spki',
    privateKeyType = 'pkcs8',
    passphrase,
    cipher = 'aes-256-cbc',
  } = options;

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: { type: publicKeyType, format: 'pem' },
    privateKeyEncoding:
      passphrase === undefined
        ? { type: privateKeyType, format: 'pem' }
        : { type: privateKeyType, format: 'pem', cipher, passphrase },
  });

  return { publicKey, privateKey };
}

/** 由私钥派生公钥（PEM / SPKI），省去额外保存公钥。 */
export function derivePublicKey(privateKey: RsaKeyInput, passphrase?: string): string {
  const keyObject = asKeyObject(privateKey, 'private', passphrase);
  return createPublicKey(keyObject).export({ type: 'spki', format: 'pem' }) as string;
}

/** 读取密钥模长（位）。非 RSA 密钥返回 `undefined`。 */
export function getRsaKeySize(key: RsaKeyInput, passphrase?: string): number | undefined {
  const keyObject = key instanceof KeyObject ? key : asKeyObject(key, 'public', passphrase);
  return keyObject.asymmetricKeyDetails?.modulusLength;
}

/**
 * 计算当前密钥与填充方案下单次加密可承载的最大明文字节数。
 *
 * RSA 不是用来加密大块数据的：2048 位 + OAEP-SHA256 只能装 190 字节。超过就该改用
 * 「RSA 加密一个随机 AES 密钥，AES 加密正文」的混合方案，或直接走 SM4 / AES。
 */
export function maxRsaPlaintextSize(
  key: RsaKeyInput,
  options: Pick<RsaEncryptOptions, 'padding' | 'oaepHash'> & { passphrase?: string } = {},
): number {
  const keyObject = asKeyObject(key, 'public', options.passphrase);
  const modulusLength = keyObject.asymmetricKeyDetails?.modulusLength;
  if (modulusLength === undefined) {
    throw new Error('无法获取 RSA 密钥模长：该密钥不是 RSA 密钥');
  }
  const keyBytes = modulusLength / 8;
  if ((options.padding ?? 'oaep') === 'pkcs1') {
    return keyBytes - 11;
  }
  return keyBytes - 2 * HASH_LENGTHS[options.oaepHash ?? 'sha256'] - 2;
}

/**
 * RSA 公钥加密。
 *
 * ⚠️ 明文长度受密钥模长限制（见 {@link maxRsaPlaintextSize}），超长会抛错；
 * 需要加密长内容请用「RSA + AES/SM4」的混合加密。
 */
export function rsaEncrypt(data: BytesLike, publicKey: RsaKeyInput, options: RsaEncryptOptions = {}): string {
  const padding = options.padding ?? 'oaep';
  const key = asKeyObject(publicKey, 'public');
  const plaintext = toBytes(data, options.textEncoding ?? 'utf8');

  const limit = maxRsaPlaintextSize(key, { padding, oaepHash: options.oaepHash });
  if (plaintext.byteLength > limit) {
    throw new Error(`RSA 明文过长：当前密钥与填充下最多 ${limit} 字节，实际 ${plaintext.byteLength} 字节`);
  }

  const ciphertext = publicEncrypt(
    { key, padding: resolvePadding(padding), oaepHash: options.oaepHash ?? 'sha256' },
    plaintext,
  );
  return bytesToString(ciphertext, options.encoding ?? 'base64');
}

/** RSA 私钥解密，参数与 {@link rsaEncrypt} 对齐。 */
export function rsaDecrypt(payload: string, privateKey: RsaKeyInput, options: RsaDecryptOptions = {}): string {
  const padding = options.padding ?? 'oaep';
  const key = asKeyObject(privateKey, 'private', options.passphrase);
  const ciphertext = toBytes(payload, options.encoding ?? 'base64');

  const plaintext = privateDecrypt(
    { key, padding: resolvePadding(padding), oaepHash: options.oaepHash ?? 'sha256' },
    ciphertext,
  );
  return plaintext.toString(options.textEncoding ?? 'utf8');
}

/** RSA 私钥签名，默认 SHA-256 + PKCS#1 v1.5（RS256）。 */
export function rsaSign(data: BytesLike, privateKey: RsaKeyInput, options: RsaSignOptions = {}): string {
  const hash = options.hash ?? 'sha256';
  const padding = options.padding ?? 'pkcs1';
  const key = asKeyObject(privateKey, 'private', options.passphrase);
  const message = toBytes(data, options.textEncoding ?? 'utf8');

  const signature = sign(
    hash,
    message,
    padding === 'pss'
      ? {
          key,
          padding: resolveSignPadding(padding),
          saltLength: options.saltLength ?? constants.RSA_PSS_SALTLEN_DIGEST,
        }
      : { key, padding: resolveSignPadding(padding) },
  );
  return bytesToString(signature, options.encoding ?? 'base64');
}

/** RSA 公钥验签，参数与 {@link rsaSign} 对齐。返回 `true` 表示签名有效。 */
export function rsaVerify(
  data: BytesLike,
  signature: string,
  publicKey: RsaKeyInput,
  options: RsaVerifyOptions = {},
): boolean {
  const hash = options.hash ?? 'sha256';
  const padding = options.padding ?? 'pkcs1';
  const key = asKeyObject(publicKey, 'public', options.passphrase);
  const message = toBytes(data, options.textEncoding ?? 'utf8');
  const signatureBuffer = toBytes(signature, options.encoding ?? 'base64');

  return verify(
    hash,
    message,
    padding === 'pss'
      ? {
          key,
          padding: resolveSignPadding(padding),
          saltLength: options.saltLength ?? constants.RSA_PSS_SALTLEN_DIGEST,
        }
      : { key, padding: resolveSignPadding(padding) },
    signatureBuffer,
  );
}

/**
 * 去掉 PEM 的头尾标记与换行，得到单行 Base64。
 *
 * 用于把密钥塞进环境变量 / 单行配置——多行 PEM 在 `.env` 里很难处理。
 */
export function pemToBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
}

/** 把单行 Base64 还原成 PEM（每 64 字符换行，结尾带换行）。{@link pemToBase64} 的逆操作。 */
export function base64ToPem(base64: string, type: string): string {
  const body = base64
    .replace(/\s+/g, '')
    .replace(/(.{64})/g, '$1\n')
    .replace(/\n$/, '');
  return `-----BEGIN ${type}-----\n${body}\n-----END ${type}-----\n`;
}
