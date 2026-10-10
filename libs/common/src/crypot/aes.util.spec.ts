import { describe, expect, it } from 'vitest';
import { aesDecrypt, aesEncrypt, aesGenerateKey } from './aes.util.js';

const KEY_128 = '0123456789abcdef';
const KEY_256_HEX = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

describe('aes', () => {
  it('默认 GCM 模式可往返（UTF-8 密钥）', () => {
    const secret = aesEncrypt('hello 世界', KEY_128);
    expect(aesDecrypt(secret, KEY_128)).toBe('hello 世界');
  });

  it('十六进制密钥下 AES-256-GCM 可往返', () => {
    const secret = aesEncrypt('payload', KEY_256_HEX, { keyEncoding: 'hex' });
    expect(aesDecrypt(secret, KEY_256_HEX, { keyEncoding: 'hex' })).toBe('payload');
  });

  it('在 CBC 模式下可往返', () => {
    const secret = aesEncrypt('cbc-payload', KEY_128, { mode: 'cbc' });
    expect(aesDecrypt(secret, KEY_128, { mode: 'cbc' })).toBe('cbc-payload');
  });

  it('缺省随机 IV：相同明文两次加密结果不同', () => {
    expect(aesEncrypt('same', KEY_128)).not.toBe(aesEncrypt('same', KEY_128));
  });

  it('指定 IV 时结果确定', () => {
    const iv = Buffer.from('0123456789ab');
    expect(aesEncrypt('same', KEY_128, { iv })).toBe(aesEncrypt('same', KEY_128, { iv }));
  });

  it('支持十六进制输出', () => {
    const secret = aesEncrypt('x', KEY_128, { encoding: 'hex' });
    expect(secret).toMatch(/^[0-9a-f]+$/);
    expect(aesDecrypt(secret, KEY_128, { encoding: 'hex' })).toBe('x');
  });

  it('附加认证数据（AAD）不一致时解密失败', () => {
    const secret = aesEncrypt('x', KEY_128, { aad: 'ctx-a' });
    expect(() => aesDecrypt(secret, KEY_128, { aad: 'ctx-b' })).toThrow();
  });

  it('密文被篡改时解密失败', () => {
    const secret = aesEncrypt('x', KEY_128);
    const raw = Buffer.from(secret, 'base64');
    raw[raw.length - 1] ^= 255;
    expect(() => aesDecrypt(raw.toString('base64'), KEY_128)).toThrow();
  });

  it('密钥错误时解密失败', () => {
    const secret = aesEncrypt('x', KEY_128);
    expect(() => aesDecrypt(secret, 'fedcba9876543210')).toThrow();
  });

  it('密钥长度非法时抛错', () => {
    expect(() => aesEncrypt('x', 'too-short')).toThrow(/AES 密钥长度/);
  });

  it('aesGenerateKey 生成正确长度的密钥', () => {
    expect(aesGenerateKey(128)).toHaveLength(16);
    expect(aesGenerateKey(256)).toHaveLength(32);
  });
});
