import { describe, expect, it } from 'vitest';
import { hmacSm3, sm3, sm3Buffer } from './sm3.util.js';

describe('sm3', () => {
  it('匹配 GB/T 32905 标准向量 SM3("abc")', () => {
    expect(sm3('abc')).toBe('66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0');
  });

  it('输出 64 个十六进制字符', () => {
    expect(sm3('hello')).toHaveLength(64);
  });

  it('支持 Base64 输出', () => {
    expect(sm3('abc', { encoding: 'base64' })).toBe(Buffer.from(sm3Buffer('abc')).toString('base64'));
  });

  it('相同输入结果稳定', () => {
    expect(sm3('重复调用')).toBe(sm3('重复调用'));
  });

  it('sm3Buffer 返回 32 字节', () => {
    expect(sm3Buffer('abc')).toHaveLength(32);
  });

  it('hmacSm3 输出 64 个十六进制字符且随密钥变化', () => {
    const a = hmacSm3('message', 'key-a');
    expect(a).toHaveLength(64);
    expect(hmacSm3('message', 'key-b')).not.toBe(a);
  });

  it('hmacSm3 相同输入结果稳定', () => {
    expect(hmacSm3('message', 'key')).toBe(hmacSm3('message', 'key'));
  });
});
