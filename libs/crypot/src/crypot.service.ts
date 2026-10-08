import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/**
 * scrypt 参数。
 *
 * 取值说明（不是拍脑袋）：
 * - `N=16384`（2^14）是 Node 官方文档给的默认成本参数，内存开销 `128 * N * r` = 16 MiB，
 *   单次哈希约 50~100 ms，足够让离线爆破变贵，又不至于拖垮登录接口的 P99；
 * - `r=8` / `p=1` 是 RFC 7914 的通用组合，也是各大实现的默认；
 * - `maxmem` 显式给到 64 MiB：Node 默认上限是 32 MiB，一旦将来把 N 调到 32768
 *   就会直接抛 `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`，显式写出来是为了让这个上限可见。
 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/** 盐长度（字节）。16 字节 = 128 bit，远高于「同盐碰撞」所需的量级。 */
const SALT_BYTES = 16;

/** 算法标识，写在哈希串首段，为将来换算法（argon2 等）留出识别位。 */
const ALGORITHM = 'scrypt';

interface ScryptParams {
  n: number;
  r: number;
  p: number;
}

interface ParsedHash extends ScryptParams {
  salt: Buffer;
  hash: Buffer;
}

/** 把回调式 `crypto.scrypt` 包成 Promise，并避免 promisify 的重载类型推断问题。 */
function scryptAsync(password: string, salt: Buffer, keylen: number, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keylen,
      { N: params.n, r: params.r, p: params.p, maxmem: SCRYPT_MAXMEM },
      (error, derivedKey) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

/**
 * 解析 `scrypt$N$r$p$salt$hash` 格式的哈希串；格式不符返回 `null`。
 *
 * 返回 `null` 而不是抛异常：`verify()` 的调用方（登录流程）只关心「验证不通过」，
 * 库里存了脏数据时应当拒绝登录，而不是把 500 抛给客户端。
 */
function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');

  if (parts.length !== 6 || parts[0] !== ALGORITHM) {
    return null;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || n <= 0 || r <= 0 || p <= 0) {
    return null;
  }

  const salt = Buffer.from(parts[4] ?? '', 'base64');
  const hash = Buffer.from(parts[5] ?? '', 'base64');

  if (salt.length === 0 || hash.length === 0) {
    return null;
  }

  return { n, r, p, salt, hash };
}

/**
 * 密码哈希服务。
 *
 * 为什么用 Node 内置 `crypto.scrypt` 而不是 bcrypt / argon2：
 * 1. 零新增依赖——后两者是原生扩展，在 Windows 上装包要过 node-gyp，
 *    且会让 CI 镜像多一层编译环境；
 * 2. scrypt 是 RFC 7914 标准算法，内存硬化（memory-hard），
 *    抗 GPU/ASIC 爆破的能力优于 bcrypt，安全强度不输；
 * 3. 纯 JS 侧调用，不参与打包器的原生模块处理，与当前 tsc 构建链无摩擦。
 *
 * 存储格式：`scrypt$N$r$p$<salt base64>$<hash base64>`
 * ——参数随哈希一起落库，将来调整成本参数时**老密码仍可验证**，
 * 不需要一次性全量重置（可配合 `needsRehash()` 做登录时渐进升级）。
 */
@Injectable()
export class CrypotService {
  /** 生成密码哈希。同一明文每次调用结果都不同（盐随机）。 */
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const params: ScryptParams = { n: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P };
    const derived = await scryptAsync(plain, salt, SCRYPT_KEYLEN, params);

    return [ALGORITHM, params.n, params.r, params.p, salt.toString('base64'), derived.toString('base64')].join('$');
  }

  /**
   * 校验明文密码是否匹配哈希串。
   *
   * 用 `timingSafeEqual` 而不是 `===`：字符串比较会在首个不同字节处提前返回，
   * 攻击者能通过响应耗时逐字节猜出哈希（时序侧信道）。
   */
  async verify(plain: string, stored: string): Promise<boolean> {
    const parsed = parseHash(stored);

    if (parsed === null) {
      return false;
    }

    const derived = await scryptAsync(plain, parsed.salt, parsed.hash.length, parsed);

    // timingSafeEqual 要求两侧长度一致，长度不等直接判否（长度本身不是秘密）。
    return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
  }

  /**
   * 判断已有哈希是否需要按当前成本参数重算。
   *
   * 用途：登录校验通过后顺手调用，为 true 就用明文重算一遍写回库，
   * 实现「不打扰用户」的渐进式参数升级。当前 CRUD 未接入，保留给认证流程。
   */
  needsRehash(stored: string): boolean {
    const parsed = parseHash(stored);

    if (parsed === null) {
      return true;
    }

    return parsed.n !== SCRYPT_N || parsed.r !== SCRYPT_R || parsed.p !== SCRYPT_P;
  }
}
