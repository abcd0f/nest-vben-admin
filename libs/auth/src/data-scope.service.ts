import { DataScopeType } from '@app/common';
import { DatabaseService } from '@app/database';
import { Injectable } from '@nestjs/common';
import { LoginUser } from './auth.context.js';

/**
 * 数据范围服务
 * 用于构建数据权限过滤条件
 */
@Injectable()
export class DataScopeService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * 获取用户可访问的部门ID列表（包含子部门）
   * 用于处理 DEPT_AND_CHILDREN 和 DEPT_AND_CHILDREN_OR_SELF 数据范围
   */
  async getDeptAndChildren(deptId: bigint, tenantId: string): Promise<bigint[]> {
    const deptIds: bigint[] = [deptId];

    // 递归查询所有子部门
    const findChildren = async (parentId: bigint) => {
      const children = await this.db.dept.findMany({
        where: {
          parentId,
          tenantId,
          delFlag: '0',
        },
        select: {
          deptId: true,
        },
      });

      for (const child of children) {
        deptIds.push(child.deptId);
        await findChildren(child.deptId);
      }
    };

    await findChildren(deptId);
    return deptIds;
  }

  /**
   * 构建用户数据范围的 Prisma WHERE 条件
   * @param user 登录用户
   * @param options 配置选项
   * @returns Prisma WHERE 条件对象
   */
  async buildDataScopeCondition(
    user: LoginUser,
    options: {
      /** 部门字段名 */
      deptIdField?: string;
      /** 创建者字段名 */
      createByField?: string;
      /** 是否包含子部门（用于 DEPT_AND_CHILDREN） */
      includeChildren?: boolean;
    } = {},
  ): Promise<any> {
    const { deptIdField = 'deptId', createByField = 'createBy', includeChildren = true } = options;

    // 超级管理员或租户管理员：无限制
    if (user.isSuperAdmin || user.isTenantAdmin) {
      return {};
    }

    const conditions: any[] = [];

    for (const role of user.roles) {
      switch (role.dataScope) {
        case DataScopeType.ALL:
          // 全部数据权限：返回空条件（无限制）
          return {};

        case DataScopeType.CUSTOM:
          // 自定义数据权限：使用角色关联的部门
          if (role.deptIds && role.deptIds.length > 0) {
            conditions.push({
              [deptIdField]: { in: role.deptIds },
            });
          }
          break;

        case DataScopeType.DEPT:
          // 本部门数据权限
          if (user.deptId) {
            conditions.push({
              [deptIdField]: user.deptId,
            });
          }
          break;

        case DataScopeType.DEPT_AND_CHILDREN:
          // 本部门及以下数据权限
          if (user.deptId && includeChildren) {
            const deptIds = await this.getDeptAndChildren(user.deptId, user.tenantId);
            conditions.push({
              [deptIdField]: { in: deptIds },
            });
          } else if (user.deptId) {
            conditions.push({
              [deptIdField]: user.deptId,
            });
          }
          break;

        case DataScopeType.SELF:
          // 仅本人数据权限
          conditions.push({
            [createByField]: user.userId,
          });
          break;

        case DataScopeType.DEPT_AND_CHILDREN_OR_SELF:
          // 本部门及以下或本人
          if (user.deptId && includeChildren) {
            const deptIds = await this.getDeptAndChildren(user.deptId, user.tenantId);
            conditions.push({
              OR: [{ [deptIdField]: { in: deptIds } }, { [createByField]: user.userId }],
            });
          } else if (user.deptId) {
            conditions.push({
              OR: [{ [deptIdField]: user.deptId }, { [createByField]: user.userId }],
            });
          } else {
            conditions.push({
              [createByField]: user.userId,
            });
          }
          break;
      }
    }

    // 如果没有任何条件，默认仅本人
    if (conditions.length === 0) {
      return {
        [createByField]: user.userId,
      };
    }

    // 多个角色的数据范围用 OR 连接
    if (conditions.length === 1) {
      return conditions[0];
    }

    return {
      OR: conditions,
    };
  }

  /**
   * 检查用户是否可以访问指定部门
   * 用于写操作的数据范围检查
   */
  async canAccessDept(user: LoginUser, deptId: bigint): Promise<boolean> {
    // 超级管理员或租户管理员：可以访问
    if (user.isSuperAdmin || user.isTenantAdmin) {
      return true;
    }

    for (const role of user.roles) {
      switch (role.dataScope) {
        case DataScopeType.ALL:
          return true;

        case DataScopeType.CUSTOM:
          if (role.deptIds?.includes(deptId)) {
            return true;
          }
          break;

        case DataScopeType.DEPT:
          if (user.deptId === deptId) {
            return true;
          }
          break;

        case DataScopeType.DEPT_AND_CHILDREN:
        case DataScopeType.DEPT_AND_CHILDREN_OR_SELF:
          if (user.deptId) {
            const deptIds = await this.getDeptAndChildren(user.deptId, user.tenantId);
            if (deptIds.includes(deptId)) {
              return true;
            }
          }
          break;

        case DataScopeType.SELF:
          // 仅本人权限不包含部门访问
          break;
      }
    }

    return false;
  }

  /**
   * 检查用户是否可以访问指定数据（创建者检查）
   * 用于写操作的数据范围检查
   */
  canAccessByCreator(user: LoginUser, createBy: bigint): boolean {
    // 超级管理员或租户管理员：可以访问
    if (user.isSuperAdmin || user.isTenantAdmin) {
      return true;
    }

    for (const role of user.roles) {
      switch (role.dataScope) {
        case DataScopeType.ALL:
          return true;

        case DataScopeType.SELF:
        case DataScopeType.DEPT_AND_CHILDREN_OR_SELF:
          if (createBy === user.userId) {
            return true;
          }
          break;
      }
    }

    return false;
  }
}
