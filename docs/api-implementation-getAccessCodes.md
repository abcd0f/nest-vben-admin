# getAccessCodesApi 接口实现文档

## 概述

该接口用于获取当前登录用户的所有权限码列表，前端使用这些权限码来控制页面和按钮的显示。

## 接口信息

- **路径**: `GET /auth/codes`
- **认证**: 需要登录（`@AuthOnly()`）
- **返回类型**: `string[]` - 权限码数组

## 实现逻辑

### 数据库关系链

```
User (用户)
  ↓ UserRole (用户-角色关联)
Role (角色)
  ↓ RoleMenu (角色-菜单关联)
Menu (菜单)
  └─ permissionCode (权限码)
```

### 查询逻辑

1. 验证用户是否激活且有效
2. 通过用户ID查询其关联的所有角色
3. 查询这些角色关联的所有菜单
4. 提取菜单中的权限码（`permission_code`字段）
5. 过滤掉空值并去重返回

### 过滤条件

- 用户：`status = 1` 且 `isDel = 0`
- 角色：`status = 1` 且 `isDel = 0`
- 菜单：`status = 1` 且 `isDel = 0` 且 `permissionCode IS NOT NULL`

## 代码实现

### Controller (apps/gateway/src/modules/auth/auth.controller.ts)

```typescript
@AuthOnly()
@Get('codes')
async getAccessCodes(@CurrentUser() current: { userId: bigint }) {
  return this.auth.getAccessCodes(current.userId);
}
```

### Service (libs/auth/src/auth.service.ts)

```typescript
async getAccessCodes(userId: bigint): Promise<string[]> {
  await this.assertActiveUser(userId);

  // 查询用户所有启用的角色关联的菜单权限码
  const menus = await this.prisma.menu.findMany({
    where: {
      roleMenus: {
        some: {
          role: {
            status: 1,
            isDel: 0,
            userRoles: {
              some: {
                userId,
                user: {
                  status: 1,
                  isDel: 0,
                },
              },
            },
          },
        },
      },
      permissionCode: { not: null },
      status: 1,
      isDel: 0,
    },
    select: {
      permissionCode: true,
    },
    distinct: ['permissionCode'],
  });

  return menus
    .map((menu) => menu.permissionCode)
    .filter((code): code is string => code !== null);
}
```

## 前端使用

前端在登录成功后会调用此接口：

```typescript
// frontend/apps/web-antdv-next/src/store/auth.ts
const [fetchUserInfoResult, accessCodes] = await Promise.all([
  fetchUserInfo(),
  getAccessCodesApi(),
]);

accessStore.setAccessCodes(accessCodes);
```

## 测试建议

1. 创建测试用户并分配角色
2. 为角色分配菜单权限
3. 登录后调用 `/auth/codes` 接口
4. 验证返回的权限码列表是否正确

## 示例返回数据

```json
[
  "system:user:list",
  "system:user:add",
  "system:user:edit",
  "system:user:delete",
  "system:role:list",
  "system:role:add"
]
```
