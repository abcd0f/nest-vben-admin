import type { PrismaService } from '@app/database';
import { BusinessException } from '@app/core';
import { MenuType } from './dto/menu.dto.js';
import { MenuService } from './menu.service.js';

describe('menuService', () => {
  it('rejects action entries without a permission code', async () => {
    const prisma = { menu: { create: vi.fn() } } as unknown as PrismaService;
    await expect(new MenuService(prisma).create({ menuType: MenuType.ACTION, menuName: 'List users' })).rejects.toBeInstanceOf(
      BusinessException,
    );
    expect(prisma.menu.create).not.toHaveBeenCalled();
  });

  it('rejects invalid menu parent types', async () => {
    const prisma = {
      menu: {
        findFirst: vi.fn().mockResolvedValue({ menuType: MenuType.MENU }),
        create: vi.fn(),
      },
    } as unknown as PrismaService;
    await expect(
      new MenuService(prisma).create({ menuType: MenuType.MENU, menuName: 'Users', parentId: '1' }),
    ).rejects.toBeInstanceOf(BusinessException);
    expect(prisma.menu.create).not.toHaveBeenCalled();
  });
});
