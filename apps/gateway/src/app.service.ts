import { paginate, PrismaService, type PageQuery, type PageResult, type Prisma, type User } from '@app/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * 用户列表（分页）。
   *
   * - 用 paginate() 把「查列表」和「查总数」并行化，返回统一的分页结构。
   * - pageSize 由 paginate() 内部封顶（MAX_PAGE_SIZE=200），防止 pageSize=999999 拖垮数据库。
   * - 软删除过滤：示例模型带 deletedAt，列表默认不返回已删数据。
   */
  list(query: PageQuery): Promise<PageResult<User>> {
    const where: Prisma.UserWhereInput = { deletedAt: null };

    return paginate(query, ({ skip, take }) =>
      Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]),
    );
  }
}
