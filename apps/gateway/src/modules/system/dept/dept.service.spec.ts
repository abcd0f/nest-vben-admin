import type { PrismaService } from '@app/database';
import { BusinessException } from '@app/core';
import { DeptService } from './dept.service.js';

describe('deptService', () => {
  it('rejects moving a department under itself or its descendant', async () => {
    const current = { deptId: 1n, parentId: null, deptName: 'A', sortOrder: 0, status: 1, deletedAt: null };
    const prisma = {
      dept: {
        findFirst: vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce({ deptId: 2n }),
        findMany: vi.fn().mockResolvedValue([{ deptId: 2n }]),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    const service = new DeptService(prisma);

    await expect(service.update(1n, { parentId: '2' })).rejects.toBeInstanceOf(BusinessException);
    expect(prisma.dept.update).not.toHaveBeenCalled();
  });

  it('rejects deleting departments with users or child departments', async () => {
    const prisma = {
      dept: { findFirst: vi.fn().mockResolvedValue({ deptId: 1n }), count: vi.fn().mockResolvedValue(0) },
      user: { count: vi.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    const service = new DeptService(prisma);

    await expect(service.remove(1n)).rejects.toBeInstanceOf(BusinessException);
  });
});
