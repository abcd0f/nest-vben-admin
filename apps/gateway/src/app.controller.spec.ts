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
  });
});
