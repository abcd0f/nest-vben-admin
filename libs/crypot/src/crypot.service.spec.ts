import { Test, TestingModule } from '@nestjs/testing';
import { CrypotService } from './crypot.service.js';

describe('crypotService', () => {
  let service: CrypotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CrypotService],
    }).compile();

    service = module.get<CrypotService>(CrypotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('哈希串格式为 scrypt$N$r$p$salt$hash', async () => {
    const hashed = await service.hash('P@ssw0rd');

    const parts = hashed.split('$');
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe('scrypt');
    expect(Number(parts[1])).toBeGreaterThan(0);
  });

  it('同一明文两次哈希结果不同（盐随机）', async () => {
    const first = await service.hash('P@ssw0rd');
    const second = await service.hash('P@ssw0rd');

    expect(first).not.toBe(second);
  });

  it('verify 对正确明文返回 true，对错误明文返回 false', async () => {
    const hashed = await service.hash('P@ssw0rd');

    await expect(service.verify('P@ssw0rd', hashed)).resolves.toBe(true);
    await expect(service.verify('p@ssw0rd', hashed)).resolves.toBe(false);
  });

  it('verify 遇到脏数据返回 false 而不是抛异常', async () => {
    await expect(service.verify('P@ssw0rd', 'not-a-valid-hash')).resolves.toBe(false);
    await expect(service.verify('P@ssw0rd', 'bcrypt$1$2$3$4$5')).resolves.toBe(false);
    await expect(service.verify('P@ssw0rd', '')).resolves.toBe(false);
  });

  it('needsRehash 对当前参数的哈希返回 false，对非法串返回 true', async () => {
    const hashed = await service.hash('P@ssw0rd');

    expect(service.needsRehash(hashed)).toBe(false);
    expect(service.needsRehash('scrypt$1$1$1$c2FsdA==$aGFzaA==')).toBe(true);
    expect(service.needsRehash('garbage')).toBe(true);
  });
});
