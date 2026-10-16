import { Injectable } from '@nestjs/common';
import { LoginUser, LoginRole } from './auth.context.js';
import {
  SUPER_ADMIN_USER_ID,
  SUPER_ADMIN_ROLE_KEY,
  TENANT_ADMIN_ROLE_KEY,
  PROTECTED_ROLE_KEYS,
  ALL_PERMISSION,
  DataScopeType,
} from '@app/common';

/**
 * 权限服务
 * 复刻 RuoYi-Vue-Plus 权限判断逻辑
 */
@Injectable()
export class PermissionService {
  /**
   * 检查用户是否为超级管理员
   */
  isSuperAdmin(user: LoginUser): boolean {
    return user.userId === SUPER_ADMIN_USER_ID;
  }

  /**
   * 检查用户是否为租户管理员
   */
  isTenantAdmin(user: LoginUser): boolean {
    return user.roles.some((role) => role.roleKey === TENANT_ADMIN_ROLE_KEY);
  }

  /**
   * 检查用户是否具有指定权限
   * @param user 登录用户
   * @param permission 权限标识
   */
  hasPermission(user: LoginUser, permission: string): boolean {
    // 超级管理员拥有所有权限
    if (this.isSuperAdmin(user)) {
      return true;
    }

    // 检查用户权限集合
    return user.permissions.has(permission) || user.permissions.has(ALL_PERMISSION);
  }

  /**
   * 检查用户是否具有指定权限之一
   * @param user 登录用户
   * @param permissions 权限标识列表
   */
  hasAnyPermission(user: LoginUser, permissions: string[]): boolean {
    return permissions.some((permission) => this.hasPermission(user, permission));
  }

  /**
   * 检查用户是否具有所有指定权限
   * @param user 登录用户
   * @param permissions 权限标识列表
   */
  hasAllPermissions(user: LoginUser, permissions: string[]): boolean {
    return permissions.every((permission) => this.hasPermission(user, permission));
  }

  /**
   * 检查用户是否具有指定角色
   * @param user 登录用户
   * @param roleKey 角色权限字符串
   */
  hasRole(user: LoginUser, roleKey: string): boolean {
    // 超级管理员拥有所有角色
    if (this.isSuperAdmin(user)) {
      return true;
    }

    return user.roles.some((role) => role.roleKey === roleKey);
  }

  /**
   * 检查用户是否具有指定角色之一
   * @param user 登录用户
   * @param roleKeys 角色权限字符串列表
   */
  hasAnyRole(user: LoginUser, roleKeys: string[]): boolean {
    return roleKeys.some((roleKey) => this.hasRole(user, roleKey));
  }

  /**
   * 检查用户是否具有所有指定角色
   * @param user 登录用户
   * @param roleKeys 角色权限字符串列表
   */
  hasAllRoles(user: LoginUser, roleKeys: string[]): boolean {
    return roleKeys.every((roleKey) => this.hasRole(user, roleKey));
  }

  /**
   * 检查角色权限字符串是否为受保护角色
   */
  isProtectedRole(roleKey: string): boolean {
    return PROTECTED_ROLE_KEYS.includes(roleKey);
  }

  /**
   * 获取用户数据范围条件（用于查询）
   * 返回应该应用的部门ID列表和是否需要创建者过滤
   */
  getDataScopeCondition(
    user: LoginUser,
    deptIdField: string = 'deptId',
    createByField: string = 'createBy',
  ): {
    type: 'all' | 'depts' | 'self' | 'mixed';
    deptIds?: bigint[];
    userId?: bigint;
  } {
    // 超级管理员和租户管理员查看全部数据
    if (this.isSuperAdmin(user) || this.isTenantAdmin(user)) {
      return { type: 'all' };
    }

    // 合并所有角色的数据范围（OR 逻辑）
    let hasAll = false;
    const deptIdSet = new Set<bigint>();
    let hasSelf = false;

    for (const role of user.roles) {
      switch (role.dataScope) {
        case DataScopeType.ALL:
          hasAll = true;
          break;

        case DataScopeType.CUSTOM:
          // 自定义数据权限：使用 role_dept 表中的部门
          if (role.deptIds && role.deptIds.length > 0) {
            role.deptIds.forEach((id) => deptIdSet.add(id));
          }
          break;

        case DataScopeType.DEPT:
          // 本部门数据权限
          if (user.deptId) {
            deptIdSet.add(user.deptId);
          }
          break;

        case DataScopeType.DEPT_AND_CHILDREN:
          // 本部门及以下数据权限（需要在服务层查询部门树）
          // 这里只添加本部门，子部门需要在具体服务中处理
          if (user.deptId) {
            deptIdSet.add(user.deptId);
          }
          break;

        case DataScopeType.SELF:
          // 仅本人数据权限
          hasSelf = true;
          break;

        case DataScopeType.DEPT_AND_CHILDREN_OR_SELF:
          // 本部门及以下或本人
          if (user.deptId) {
            deptIdSet.add(user.deptId);
          }
          hasSelf = true;
          break;
      }
    }

    // 如果任一角色有全部权限，返回全部
    if (hasAll) {
      return { type: 'all' };
    }

    // 如果有部门权限和个人权限
    if (deptIdSet.size > 0 && hasSelf) {
      return {
        type: 'mixed',
        deptIds: Array.from(deptIdSet),
        userId: user.userId,
      };
    }

    // 仅部门权限
    if (deptIdSet.size > 0) {
      return {
        type: 'depts',
        deptIds: Array.from(deptIdSet),
      };
    }

    // 仅个人权限
    if (hasSelf) {
      return {
        type: 'self',
        userId: user.userId,
      };
    }

    // 默认仅本人
    return {
      type: 'self',
      userId: user.userId,
    };
  }

  /**
   * 检查用户是否可以访问指定部门的数据
   */
  canAccessDept(user: LoginUser, deptId: bigint): boolean {
    const condition = this.getDataScopeCondition(user);

    if (condition.type === 'all') {
      return true;
    }

    if (condition.type === 'depts' || condition.type === 'mixed') {
      return condition.deptIds?.includes(deptId) ?? false;
    }

    return false;
  }

  /**
   * 检查用户是否可以访问指定用户创建的数据
   */
  canAccessUserData(user: LoginUser, createBy: bigint): boolean {
    const condition = this.getDataScopeCondition(user);

    if (condition.type === 'all') {
      return true;
    }

    if (condition.type === 'self' || condition.type === 'mixed') {
      return condition.userId === createBy;
    }

    return false;
  }
}
