import { describe, expect, it } from 'vitest';
import { sm4Decrypt, sm4Encrypt, sm4GenerateKey } from './sm4.util.js';

const KEY_HEX = '0123456789abcdeffedcba9876543210';
const KEY = Buffer.from(KEY_HEX, 'hex');

describe('sm4', () => {
  it('匹配 GB/T 32907 标准向量（ECB + 关闭填充）', () => {
    const cipher = sm4Encrypt(KEY_HEX, KEY_HEX, {
      mode: 'ecb',
      padding: false,
      keyEncoding: 'hex',
      textEncoding: 'hex',
      encoding: 'hex',
    });
    expect(cipher).toBe('681edf34d206965e86b3e94f536e4246');
  });

  it('默认 CBC 模式可往返', () => {
    const secret = sm4Encrypt('hello 世界', KEY);
    expect(sm4Decrypt(secret, KEY)).toBe('hello 世界');
  });

  it('流模式（CTR / CFB / OFB）可往返', () => {
    for (const mode of ['ctr', 'cfb', 'ofb'] as const) {
      const secret = sm4Encrypt('stream-payload', KEY, { mode });
      expect(sm4Decrypt(secret, KEY, { mode })).toBe('stream-payload');
    }
  });

  it('在 ECB 模式下可往返', () => {
    const secret = sm4Encrypt('ecb-payload', KEY, { mode: 'ecb' });
    expect(sm4Decrypt(secret, KEY, { mode: 'ecb' })).toBe('ecb-payload');
  });

  it('缺省随机 IV：相同明文两次加密结果不同', () => {
    expect(sm4Encrypt('same', KEY)).not.toBe(sm4Encrypt('same', KEY));
  });

  it('密钥长度非法时抛错', () => {
    expect(() => sm4Encrypt('x', 'short')).toThrow(/SM4 密钥长度/);
  });

  it('关闭填充时明文长度必须是分组整数倍', () => {
    expect(() => sm4Encrypt('not-a-block', KEY, { padding: false })).toThrow();
  });

  it('sm4GenerateKey 生成 16 字节密钥', () => {
    expect(sm4GenerateKey()).toHaveLength(16);
  });
});
