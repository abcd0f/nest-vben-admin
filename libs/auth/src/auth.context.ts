import { Injectable, ExecutionContext, createParamDecorator } from '@nestjs/common';
import { DEFAULT_TENANT_ID } from '@app/common';

/**
 * 登录用户信息接口
 */
export interface LoginUser {
  /** 用户ID */
  userId: bigint;
  /** 租户ID */
  tenantId: string;
  /** 用户名 */
  userName: string;
  /** 部门ID */
  deptId?: bigint;
  /** 角色列表 */
  roles: LoginRole[];
  /** 权限集合 */
  permissions: Set<string>;
  /** 是否超级管理员 */
  isSuperAdmin: boolean;
  /** 是否租户管理员 */
  isTenantAdmin: boolean;
}

/**
 * 登录角色信息
 */
export interface LoginRole {
  /** 角色ID */
  roleId: bigint;
  /** 角色权限字符串 */
  roleKey: string;
  /** 角色名称 */
  roleName: string;
  /** 数据范围 */
  dataScope: string;
  /** 自定义部门权限 */
  deptIds?: bigint[];
}

/**
 * 获取当前登录用户装饰器
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): LoginUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * 获取当前租户ID装饰器
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId || DEFAULT_TENANT_ID;
  },
);

/**
 * 获取当前用户ID装饰器
 */
export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): bigint | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId;
  },
);

/**
 * 获取当前部门ID装饰器
 */
export const CurrentDeptId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): bigint | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.deptId;
  },
);
