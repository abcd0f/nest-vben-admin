/** 分页入参（通常来自 query string，故允许 string） */
export interface PageQuery {
  page?: number | string;
  pageSize?: number | string;
}

/** 标准分页出参 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

/**
 * 归一化分页参数。
 *
 * 规则（对 page / pageSize 一致）：
 * - 非法值（非数字、NaN、<= 0、Infinity）→ 回落到默认值
 * - 合法值 → pageSize 封顶 MAX_PAGE_SIZE
 *
 * 不做封顶的话，一个 `pageSize=999999` 的请求就能把数据库拖垮。
 */
export function normalizePage(query: PageQuery = {}): {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
} {
  const rawPage = Math.trunc(Number(query.page));
  const rawPageSize = Math.trunc(Number(query.pageSize));

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(MAX_PAGE_SIZE, rawPageSize) : DEFAULT_PAGE_SIZE;

  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

/**
 * 分页查询：把「查列表」和「查总数」并行化，一次调用拿到标准分页结果。
 *
 * @example
 * return paginate(query, ({ skip, take }) =>
 *   Promise.all([
 *     this.prisma.user.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
 *     this.prisma.user.count(),
 *   ]),
 * );
 */
export async function paginate<T>(
  query: PageQuery,
  run: (pagination: { skip: number; take: number }) => Promise<[T[], number]>,
): Promise<PageResult<T>> {
  const { skip, take, page, pageSize } = normalizePage(query);
  const [list, total] = await run({ skip, take });

  return {
    list,
    total,
    page,
    pageSize,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}
