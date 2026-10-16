export * from './database.module.js';
export * from './database.service.js';
// ---- Prisma 生成物的对外出口 ----
// 只暴露「类型 + Prisma 命名空间」，不导出 PrismaClient 值：
// 业务代码必须通过 DI 拿到实例，否则会绕开连接池与生命周期管理，各起一份连接。
export { Prisma } from './generated/prisma/client.js';
// 实体类型（User ...）。注意：这些只在 client.ts 里导出，models.ts 里没有，
// 因此新增模型时需要在此补一行（生成器不提供「除 Prisma 外的全部类型」这种出口）。
export type { User } from './generated/prisma/client.js';

export type * from './generated/prisma/models.js';
export * from './helpers/pagination.js';
export * from './prisma.service.js';
