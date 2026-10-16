/**
 * 系统常量定义
 * 复刻 RuoYi-Vue-Plus 系统常量
 */

/**
 * 超级管理员用户ID
 */
export const SUPER_ADMIN_USER_ID = 1n;

/**
 * 超级管理员角色权限字符串
 */
export const SUPER_ADMIN_ROLE_KEY = 'superadmin';

/**
 * 租户管理员角色权限字符串
 */
export const TENANT_ADMIN_ROLE_KEY = 'admin';

/**
 * 受保护的角色权限字符串列表
 */
export const PROTECTED_ROLE_KEYS = [SUPER_ADMIN_ROLE_KEY, TENANT_ADMIN_ROLE_KEY];

/**
 * 默认租户ID
 */
export const DEFAULT_TENANT_ID = '000000';

/**
 * 数据范围类型
 */
export enum DataScopeType {
  /** 全部数据权限 */
  ALL = '1',
  /** 自定义数据权限 */
  CUSTOM = '2',
  /** 本部门数据权限 */
  DEPT = '3',
  /** 本部门及以下数据权限 */
  DEPT_AND_CHILDREN = '4',
  /** 仅本人数据权限 */
  SELF = '5',
  /** 本部门及以下或本人 */
  DEPT_AND_CHILDREN_OR_SELF = '6',
}

/**
 * 菜单类型
 */
export enum MenuType {
  /** 目录 */
  DIRECTORY = 'M',
  /** 菜单 */
  MENU = 'C',
  /** 按钮 */
  BUTTON = 'F',
}

/**
 * 状态常量
 */
export enum StatusType {
  /** 正常 */
  NORMAL = '0',
  /** 停用 */
  DISABLED = '1',
}

/**
 * 删除标志
 */
export enum DelFlag {
  /** 未删除 */
  NORMAL = '0',
  /** 已删除 */
  DELETED = '2',
}

/**
 * 用户性别
 */
export enum UserSex {
  /** 男 */
  MALE = '0',
  /** 女 */
  FEMALE = '1',
  /** 未知 */
  UNKNOWN = '2',
}

/**
 * 显示状态
 */
export enum VisibleType {
  /** 显示 */
  VISIBLE = '1',
  /** 隐藏 */
  HIDDEN = '0',
}

/**
 * 是否外链
 */
export enum FrameType {
  /** 是 */
  YES = '1',
  /** 否 */
  NO = '0',
}

/**
 * 是否缓存
 */
export enum CacheType {
  /** 缓存 */
  CACHE = '1',
  /** 不缓存 */
  NO_CACHE = '0',
}

/**
 * 部门根节点ID
 */
export const DEPT_ROOT_PARENT_ID = 0n;

/**
 * 菜单根节点ID
 */
export const MENU_ROOT_PARENT_ID = 0n;

/**
 * 全部权限标识
 */
export const ALL_PERMISSION = '*:*:*';
