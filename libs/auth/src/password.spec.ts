import { hashPassword, isPasswordHash, verifyPassword } from './password.js';

describe('password', () => {
  it('uses a different salted hash for each write and verifies only the right password', async () => {
    const first = await hashPassword('P@ssw0rd');
    const second = await hashPassword('P@ssw0rd');

    expect(first).not.toBe(second);
    expect(isPasswordHash(first)).toBe(true);
    expect(await verifyPassword('P@ssw0rd', first)).toBe(true);
    expect(await verifyPassword('wrong', first)).toBe(false);
  });

  it('does not accept legacy plaintext or malformed hashes', async () => {
    expect(await verifyPassword('P@ssw0rd', 'P@ssw0rd')).toBe(false);
    expect(await verifyPassword('P@ssw0rd', 'scrypt$16384$8$1$bad$bad')).toBe(false);
  });
});
