import { PrismaService } from '@app/database';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('appController', () => {
  let appController: AppController;

  const prismaMock = {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('list', () => {
    it('应返回标准分页结构', async () => {
      await expect(appController.list({})).resolves.toMatchObject({
        list: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
    });

    it('响应中不得出现 password 等敏感字段', async () => {
      const row = {
        id: '00000000-0000-0000-0000-000000000000',
        username: 'admin',
        email: null,
        password: 'hashed-secret',
        nickname: null,
        status: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
      };

      prismaMock.user.findMany.mockResolvedValueOnce([row]);
      prismaMock.user.count.mockResolvedValueOnce(1);

      const result = await appController.list({});

      expect(result.total).toBe(1);
      expect(result.list[0]).not.toHaveProperty('password');
      expect(result.list[0]).not.toHaveProperty('deletedAt');
      expect(result.list[0]?.username).toBe('admin');
    });
  });
});
