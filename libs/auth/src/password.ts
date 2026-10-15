import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const PREFIX = `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}`;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function isPasswordHash(stored: string): boolean {
  const parts = stored.split('$');
  return (
    parts.length === 6 &&
    parts.slice(0, 4).join('$') === PREFIX &&
    /^[0-9a-f]{32}$/.test(parts[4]) &&
    /^[0-9a-f]{128}$/.test(parts[5])
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await deriveKey(password, salt);
  return `${PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isPasswordHash(stored)) {
    return false;
  }

  const parts = stored.split('$');
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(actual, expected);
}
