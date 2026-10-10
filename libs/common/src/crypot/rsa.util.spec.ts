import type { RsaKeyPair } from './rsa.util.js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  base64ToPem,
  derivePublicKey,
  generateRsaKeyPair,
  getRsaKeySize,
  maxRsaPlaintextSize,
  pemToBase64,
  rsaDecrypt,
  rsaEncrypt,
  rsaSign,
  rsaVerify,
} from './rsa.util.js';

describe('rsa', () => {
  let pair: RsaKeyPair;

  beforeAll(() => {
    pair = generateRsaKeyPair();
  });

  it('生成 2048 位 PKCS#8 / SPKI 的 PEM 密钥对', () => {
    expect(pair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(pair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(getRsaKeySize(pair.publicKey)).toBe(2048);
  });

  it('可由私钥派生公钥', () => {
    expect(derivePublicKey(pair.privateKey)).toBe(pair.publicKey);
  });

  it('采用 OAEP 加解密可往返', () => {
    const secret = rsaEncrypt('top-secret', pair.publicKey);
    expect(rsaDecrypt(secret, pair.privateKey)).toBe('top-secret');
  });

  it('采用 PKCS#1 v1.5 加解密可往返', () => {
    const secret = rsaEncrypt('legacy', pair.publicKey, { padding: 'pkcs1' });
    expect(rsaDecrypt(secret, pair.privateKey, { padding: 'pkcs1' })).toBe('legacy');
  });

  it('签名与验签（RS256 / PKCS#1）', () => {
    const signature = rsaSign('message', pair.privateKey);
    expect(rsaVerify('message', signature, pair.publicKey)).toBe(true);
    expect(rsaVerify('tampered', signature, pair.publicKey)).toBe(false);
  });

  it('签名与验签（PSS）', () => {
    const signature = rsaSign('message', pair.privateKey, { padding: 'pss' });
    expect(rsaVerify('message', signature, pair.publicKey, { padding: 'pss' })).toBe(true);
  });

  it('用另一对密钥验签失败', () => {
    const other = generateRsaKeyPair();
    const signature = rsaSign('message', pair.privateKey);
    expect(rsaVerify('message', signature, other.publicKey)).toBe(false);
  });

  it('maxRsaPlaintextSize 计算正确（2048 位）', () => {
    expect(maxRsaPlaintextSize(pair.publicKey)).toBe(190); // OAEP-SHA256
    expect(maxRsaPlaintextSize(pair.publicKey, { padding: 'pkcs1' })).toBe(245);
  });

  it('明文超过上限时抛错', () => {
    expect(() => rsaEncrypt('a'.repeat(191), pair.publicKey)).toThrow(/明文过长/);
  });

  it('支持带口令的加密私钥', () => {
    const encrypted = generateRsaKeyPair({ passphrase: 'p@ssw0rd' });
    expect(encrypted.privateKey).toContain('-----BEGIN ENCRYPTED PRIVATE KEY-----');
    const secret = rsaEncrypt('with-passphrase', encrypted.publicKey);
    expect(rsaDecrypt(secret, encrypted.privateKey, { passphrase: 'p@ssw0rd' })).toBe('with-passphrase');
  });

  it('pemToBase64 / base64ToPem 可往返', () => {
    const single = pemToBase64(pair.publicKey);
    expect(single).not.toContain('-----');
    expect(single).not.toContain('\n');
    expect(base64ToPem(single, 'PUBLIC KEY')).toBe(pair.publicKey);
  });
});
