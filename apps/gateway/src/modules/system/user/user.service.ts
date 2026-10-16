import { AuthService } from '@app/auth';
import { toDto, toPageDto } from '@app/common';
import { BusinessException } from '@app/core';
import { paginate, Prisma, PrismaService } from '@app/database';
import { PermissionService } from '@app/permission';
import { Injectable, Optional } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { QueryUserDto } from './dto/query-user.dto.js';
import { UserPageDto, UserResponseDto } from './dto/response.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

/**
 * 判断字段「是否真的带了值」。
 *
 * 不能只判 `!== undefined`：`PartialType()` 给更新 DTO 的每个字段都加了
 * `@IsOptional()`，而 class-validator 的 `@IsOptional()` 对 `null` 和 `undefined`
 * 一视同仁地跳过校验——JSON 里的 `{"username": null}` 能一路走到 service。
 * 若直接拿去查库，`findUnique({ where: { username: null } })` 会让 Prisma 抛
 * 参数错误，最终是一个没有上下文的 500。
 *
 * 这里把 `null` 与 `undefined` 统一视为「未传」，与 `normalizeFilter()` 对空串的
 * 处理保持一致：**本模块的 PATCH 语义是「只改真的传了值的字段」**。
 * 可空列（`email` / `nickName`）是例外——那里 `null` 有明确含义（清空），
 * 见 `update()` 里的分支。
 */
function isPresent<T>(value: null | T | undefined): value is T {
  return value !== undefined && value !== null;
}

/**
 * 把筛选串归一化：去掉首尾空白，空串视为「未传」。
 *
 * 必要性：前端表单清空后提交的是 `?username=`（空串），若直接拿去查
 * `contains: ''`，PostgreSQL 会命中**所有**行——看起来像筛选失效，
 * 实际是条件被当成了「匹配任意字符串」。
 */
function normalizeFilter(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * 把 Prisma 唯一约束冲突（P2002）翻译成业务异常。
 *
 * 为什么不能只靠 `assertUsernameAvailable()` 的预检查：
 * 「先查再写」之间存在竞态窗口——两个并发请求可以同时通过检查，
 * 最终由数据库的唯一索引拦下其中一个。预检查负责给出**友好的提示语**，
 * 这里负责**兜底正确性**，两者缺一不可。
 */
function toUniqueViolation(error: unknown, message: string): BusinessException | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }

  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.filter((item): item is string => typeof item === 'string') : [];

  return BusinessException.conflict(fields.length > 0 ? `${message}（冲突字段：${fields.join('、')}）` : message, {
    cause: error,
  });
}

/**
 * 用户 CRUD 服务。
 *
 * 约定（与 `prisma/schema.prisma` 的 `User` 模型一一对应）：
 * - **软删除**：`remove()` 只写 `isDel = 1`，不物理删除。所有查询都带
 *   `isDel: 0`，被删数据默认不可见；
 * - **密码哈希**：创建时存储强哈希，出参不含 `password` / `isDel`；
 * - **越界字段不进库**：入参只取 DTO 上声明过的字段，不把 `dto` 直接展开给 Prisma，
 *   否则全局校验管道被绕过（或将来有人关掉 `whitelist`）时会变成批量赋值漏洞。
 */
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    @Optional() private readonly permissions?: PermissionService,
  ) {}

  /** 新增用户。用户名 / 邮箱冲突返回 409。 */
  async create(dto: CreateUserDto, actorId?: bigint): Promise<UserResponseDto> {
    await this.assertUsernameAvailable(dto.username);

    if (dto.email !== undefined) {
      await this.assertEmailAvailable(dto.email);
    }

    const passwordHash = await this.auth.hashPassword(dto.password);
    const deptId = dto.deptId == null ? null : await this.resolveDept(dto.deptId);
    if (actorId !== undefined) await this.assertCreateScope(actorId, deptId);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          password: passwordHash,
          email: dto.email ?? null,
          nickName: dto.nickName ?? null,
          deptId,
        },
      });

      return toDto(UserResponseDto, user)!;
    } catch (error) {
      const conflict = toUniqueViolation(error, '用户名或邮箱已被占用');
      if (conflict !== null) {
        throw conflict;
      }

      throw error;
    }
  }

  /** 分页查询用户列表。 */
  async findPage(query: QueryUserDto, actorId?: bigint): Promise<UserPageDto> {
    const where = this.buildWhere(query);
    if (actorId !== undefined) Object.assign(where, await this.scopeWhere(actorId, 'system:user:list'));

    const result = await paginate(query, ({ skip, take }) => {
      return Promise.all([
        this.prisma.user.findMany({ where, skip, take, orderBy: { createdTime: 'desc' } }),
        this.prisma.user.count({ where }),
      ]);
    });

    return toPageDto(UserResponseDto, result);
  }

  /** 查询用户详情，不存在（或已软删除）返回 404。 */
  async findOne(userId: bigint, actorId?: bigint): Promise<UserResponseDto> {
    if (actorId !== undefined) await this.assertUserScope(actorId, 'system:user:query', userId);
    const user = await this.prisma.user.findFirst({ where: { userId, isDel: 0 } });

    if (user === null) {
      throw BusinessException.notFound('用户不存在');
    }

    return toDto(UserResponseDto, user)!;
  }

  /**
   * 更新用户。只更新显式传入的资料字段。
   *
   * `null` 的语义按列是否可空区分（对齐 `schema.prisma`）：
   * - `email` / `nickName` 是 `String?`，传 `null` 表示**清空该列**；
   * - `username` / `status` 是 NOT NULL，传 `null` 视为**未传**
   *   （忽略）。它们没有「清空」这个状态，把 `null` 写进 Prisma 只会换来一个 500。
   */
  async update(userId: bigint, dto: UpdateUserDto, actorId?: bigint): Promise<UserResponseDto> {
    if (actorId !== undefined) await this.assertUserScope(actorId, 'system:user:update', userId);
    if (dto.status === 0) await this.assertNotLastSystemAdmin(userId);
    const current = await this.prisma.user.findFirst({ where: { userId, isDel: 0 } });

    if (current === null) {
      throw BusinessException.notFound('用户不存在');
    }

    // 只在「值真的变了」时做唯一性预检查：否则改昵称时把原用户名再传一遍
    // 会命中自己这条记录，误报「用户名已存在」。
    if (isPresent(dto.username) && dto.username !== current.username) {
      await this.assertUsernameAvailable(dto.username);
    }

    // email 可空，传 null 是「清空」而非「改成一个新邮箱」，不做唯一性预检查
    // ——`findUnique({ where: { email: null } })` 会让 Prisma 抛参数错误。
    if (isPresent(dto.email) && dto.email !== current.email) {
      await this.assertEmailAvailable(dto.email);
    }

    const data: Prisma.UserUpdateInput = {};

    if (isPresent(dto.username)) {
      data.username = dto.username;
    }
    if (dto.email !== undefined) {
      data.email = dto.email;
    }
    if (dto.nickName !== undefined) {
      data.nickName = dto.nickName;
    }
    if (isPresent(dto.status)) {
      data.status = dto.status;
    }
    if (dto.deptId !== undefined) {
      if (actorId !== undefined && dto.deptId !== null) await this.assertDeptScope(actorId, 'system:user:update', BigInt(dto.deptId));
      data.dept = dto.deptId === null ? { disconnect: true } : { connect: { deptId: await this.resolveDept(dto.deptId) } };
    }
    try {
      const user = await this.prisma.user.update({ where: { userId }, data });

      return toDto(UserResponseDto, user)!;
    } catch (error) {
      const conflict = toUniqueViolation(error, '用户名或邮箱已被占用');
      if (conflict !== null) {
        throw conflict;
      }

      throw error;
    }
  }

  /**
   * 软删除用户：写 `isDel = 1`，行保留。
   *
   * 注意一个副作用：`users.username` / `users.email` 上的唯一索引是**全局的**，
   * 不含 `isDel` 条件，因此被软删除的用户名不会被释放——同名重建会返回 409。
   * 若要允许复用，应改为「删除时把 username 改写为 `name#<uuid>`」的部分索引方案，
   * 那是一次 schema 变更，不在本次范围。
   */
  async remove(userId: bigint, actorId?: bigint): Promise<void> {
    if (actorId !== undefined) await this.assertUserScope(actorId, 'system:user:delete', userId);
    await this.assertNotLastSystemAdmin(userId);
    const current = await this.prisma.user.findFirst({ where: { userId, isDel: 0 } });

    if (current === null) {
      throw BusinessException.notFound('用户不存在');
    }

    await this.prisma.user.update({ where: { userId }, data: { isDel: 1 } });
  }

  async changeOwnPassword(userId: bigint, dto: { currentPassword: string; newPassword: string }): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { userId, status: 1, isDel: 0 } });
    if (user === null || !(await this.auth.verifyPassword(dto.currentPassword, user.password))) {
      throw BusinessException.badRequest('当前密码错误');
    }
    await this.prisma.user.update({ where: { userId }, data: { password: await this.auth.hashPassword(dto.newPassword) } });
  }

  async resetPassword(userId: bigint, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { userId, isDel: 0 } });
    if (user === null) throw BusinessException.notFound('用户不存在');
    await this.prisma.user.update({ where: { userId }, data: { password: await this.auth.hashPassword(newPassword) } });
  }

  private async assertCreateScope(actorId: bigint, deptId: bigint | null) {
    if (!this.permissions) return;
    const scope = await this.permissions.getDataScope(actorId, 'system:user:create');
    if (scope.all) return;
    if (deptId === null || !scope.deptIds.has(deptId)) throw BusinessException.forbidden('超出允许的数据范围');
  }

  private async assertNotLastSystemAdmin(userId: bigint) {
    const isAdmin = await this.prisma.userRole.findFirst({ where: { userId, role: { isSystem: true, status: 1, isDel: 0 } } });
    if (!isAdmin) return;
    const count = await this.prisma.userRole.count({ where: { role: { isSystem: true, status: 1, isDel: 0 }, user: { status: 1, isDel: 0 } } });
    if (count <= 1) throw BusinessException.conflict('不能停用或删除最后一个有效授权管理员');
  }

  private async assertDeptScope(actorId: bigint, code: string, deptId: bigint) {
    if (!this.permissions) return;
    const scope = await this.permissions.getDataScope(actorId, code);
    if (!scope.all && !scope.deptIds.has(deptId)) throw BusinessException.forbidden('超出允许的数据范围');
  }

  private async assertUserScope(actorId: bigint, code: string, targetUserId: bigint) {
    if (!this.permissions) return;
    const target = await this.prisma.user.findFirst({ where: { userId: targetUserId, isDel: 0 }, select: { userId: true, deptId: true } });
    if (!target) throw BusinessException.notFound('用户不存在');
    const scope = await this.permissions.getDataScope(actorId, code);
    if (scope.all || (scope.self && target.userId === actorId) || (target.deptId !== null && scope.deptIds.has(target.deptId))) return;
    throw BusinessException.forbidden('超出允许的数据范围');
  }

  private async scopeWhere(actorId: bigint, code: string): Promise<Prisma.UserWhereInput> {
    if (!this.permissions) return {};
    const scope = await this.permissions.getDataScope(actorId, code);
    if (scope.all) return {};
    const clauses: Prisma.UserWhereInput[] = [];
    if (scope.self) clauses.push({ userId: actorId });
    if (scope.deptIds.size > 0) clauses.push({ deptId: { in: [...scope.deptIds] } });
    if (clauses.length === 0) throw BusinessException.forbidden('没有可访问的数据范围');
    return { OR: clauses };
  }

  /** 组装列表查询条件：软删除过滤 + 模糊匹配 + 状态等值。 */
  private buildWhere(query: QueryUserDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = { isDel: 0 };

    const username = normalizeFilter(query.username);
    const email = normalizeFilter(query.email);
    const nickName = normalizeFilter(query.nickName);

    if (username !== undefined) {
      // mode: 'insensitive' 让模糊匹配大小写无关（PostgreSQL ILIKE 语义）。
      where.username = { contains: username, mode: 'insensitive' };
    }
    if (email !== undefined) {
      where.email = { contains: email, mode: 'insensitive' };
    }
    if (nickName !== undefined) {
      where.nickName = { contains: nickName, mode: 'insensitive' };
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.deptId != null) where.deptId = BigInt(query.deptId);

    return where;
  }

  private async resolveDept(value: string): Promise<bigint> {
    const deptId = BigInt(value);
    if (deptId > 9223372036854775807n) throw BusinessException.badRequest('部门 ID 超出 BIGINT 范围');
    const dept = await this.prisma.dept.findFirst({ where: { deptId, status: 1, isDel: 0 } });
    if (dept === null) throw BusinessException.badRequest('部门不存在、已停用或已删除');
    return deptId;
  }

  /**
   * 用户名可用性检查。
   *
   * 刻意**不带** `isDel: 0`：唯一索引是全局的，只查存活记录会让预检查
   * 放行、然后由数据库抛 P2002，用户拿到的就是一句没有上下文的冲突提示。
   * 这里提前把「被已删除记录占用」这个原因讲清楚。
   */
  private async assertUsernameAvailable(username: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { username },
      select: { userId: true, isDel: true },
    });

    if (existing === null) {
      return;
    }

    throw BusinessException.conflict(
      existing.isDel === 0 ? '用户名已存在' : '该用户名已被一条已删除的用户占用，请更换用户名',
    );
  }

  /** 邮箱可用性检查，语义同 `assertUsernameAvailable()`。 */
  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { userId: true, isDel: true },
    });

    if (existing === null) {
      return;
    }

    throw BusinessException.conflict(
      existing.isDel === 0 ? '邮箱已存在' : '该邮箱已被一条已删除的用户占用，请更换邮箱',
    );
  }
}
