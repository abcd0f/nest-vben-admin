import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service.js';
import { PrismaService } from './prisma.service.js';

describe('databaseService', () => {
  let service: DatabaseService;

  const prismaMock = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('health() 连通时返回 up', async () => {
    await expect(service.health()).resolves.toMatchObject({ status: 'up' });
  });

  it('health() 断开时返回 down 并带错误信息', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

    await expect(service.health()).resolves.toMatchObject({
      status: 'down',
      error: 'connection refused',
    });
  });
});
