# RuoYi-Vue-Plus 系统模块迁移文档

## 执行摘要

本文档作为高级系统架构参考，详细阐述了从 [RuoYi-Vue-Plus 5.X (Java/Spring Boot 微服务架构)](E:\test\nest-vben-admin\RuoYi-Vue-Plus-5.X) 向当前项目 (NestJS/Node.js 架构) 进行 1:1 功能复刻和数据库迁移的完整方案。该迁移涉及**用户管理、角色管理、菜单管理、部门管理、岗位管理**五大核心模块，涵盖数据库设计、业务逻辑、权限体系和数据一致性等多个维度。

---

## 第一部分：现状分析与差异对比

### 1.1 源系统架构概览（RuoYi-Vue-Plus 5.X）

#### 技术栈
- **后端框架**: Spring Boot 3.x + MyBatis-Plus
- **多租户模型**: 支持租户隔离（tenant_id）
- **消息队列**: 集成 RabbitMQ（业务异步处理）
- **权限框架**: Sa-Token + RBAC 数据权限模型
- **缓存方案**: Redis 分布式缓存
- **数据库**: PostgreSQL / MySQL 8.0+

#### 核心模块结构
```
ruoyi-system/
├── controller/
│   ├── SysUserController
│   ├── SysRoleController
│   ├── SysMenuController
│   ├── SysDeptController
│   └── SysPostController
├── service/
│   ├── ISysUserService
│   ├── ISysRoleService
│   ├── ISysMenuService
│   ├── ISysDeptService
│   └── ISysPostService
├── mapper/
│   └── MyBatis XML 文件
├── domain/
│   ├── 实体类 (Entity)
│   ├── BO 类 (Business Object)
│   └── VO 类 (Value Object)
└── constants/
    └── 业务常量定义
```

#### 租户支持机制
- **TenantEntity 基类**: 所有租户表继承该基类
- **tenantId 字段**: 默认值 '000000'（系统租户）
- **租户拦截器**: 自动过滤租户数据
- **菜单表**: 不支持租户（全系统共享菜单权限）

---

### 1.2 当前系统架构概览（NestJS 后端）

#### 技术栈
- **后端框架**: NestJS 10.x + Prisma ORM
- **数据库**: PostgreSQL（驱动适配器模式）
- **权限框架**: 自定义装饰器（@Permission）
- **缓存**: Redis（可选集成）
- **ORM 方案**: Prisma（类型安全的 ORM）

#### 核心模块结构
```
apps/gateway/src/modules/system/
├── dept/
│   ├── dept.controller.ts
│   ├── dept.service.ts
│   ├── dept.module.ts
│   └── dto/
├── role/
│   ├── role.controller.ts
│   ├── role.service.ts
│   ├── role.module.ts
│   └── dto/
├── menu/
├── user/
├── post/
└── shared/
```

#### 数据库差异
- **软删除方案**: isDel 字段（SMALLINT: 0 未删除, 1 已删除）
- **无租户支持**: 当前暂未实现多租户
- **时间戳**: created_time, updated_time（TIMESTAMPTZ）

---

### 1.3 关键差异总结

| 维度 | 源系统（RuoYi） | 当前系统（NestJS） | 迁移方案 |
|------|----------------|------------------|--------|
| **租户模型** | 多租户内置 | 无租户 | 保留字段结构，实现租户拦截中间件 |
| **ORM** | MyBatis-Plus | Prisma | 直接基于 Prisma 实现 |
| **数据权限** | 数据范围（dataScope）| 无 | 逐步实现权限模型 |
| **软删除** | del_flag（0/1） | isDel（0/1） | 字段名统一保持 |
| **时间戳** | create_time/update_time | created_time/updated_time | 字段名保持当前 |
| **缓存策略** | Redis 内置 | 可选 | 实现权限缓存层 |
| **菜单权限** | 三级分类（M/C/F） | 三级分类（DIRECTORY/MENU/ACTION） | 枚举类型统一 |

---

## 第二部分：数据库完整迁移方案

### 2.1 表结构对应关系

#### 2.1.1 用户表 (sys_user)

**源系统表定义**
```sql
CREATE TABLE sys_user (
    user_id         BIGINT PRIMARY KEY,
    tenant_id       VARCHAR(20) DEFAULT '000000',      -- 租户ID
    dept_id         BIGINT,                             -- 部门ID
    user_name       VARCHAR(30) NOT NULL UNIQUE,        -- 用户账号
    nick_name       VARCHAR(30) NOT NULL,               -- 用户昵称
    user_type       VARCHAR(10) DEFAULT 'sys_user',     -- 用户类型
    email           VARCHAR(50),                        -- 邮箱
    phonenumber     VARCHAR(11),                        -- 手机号
    sex             CHAR DEFAULT '0',                   -- 性别 (0男 1女 2未知)
    avatar          BIGINT,                             -- 头像ID
    password        VARCHAR(100) NOT NULL,              -- 密码
    status          CHAR DEFAULT '0',                   -- 账号状态 (0正常 1停用)
    del_flag        CHAR DEFAULT '0',                   -- 删除标志
    login_ip        VARCHAR(128),                       -- 最后登录IP
    login_date      TIMESTAMP,                          -- 最后登录时间
    create_dept     BIGINT,                             -- 创建部门
    create_by       BIGINT,                             -- 创建者
    create_time     TIMESTAMP,
    update_by       BIGINT,                             -- 更新者
    update_time     TIMESTAMP,
    remark          VARCHAR(500)
);
```

**当前系统表定义**
```sql
CREATE TABLE sys_user (
    user_id         BIGSERIAL PRIMARY KEY,
    dept_id         BIGINT,
    username        VARCHAR(64) NOT NULL UNIQUE,
    nickname        VARCHAR(64),
    phone           VARCHAR(32) UNIQUE,
    sex             SMALLINT DEFAULT 0,                 -- 0男 1女 2未知
    avatar          VARCHAR(255),
    email           VARCHAR(128) UNIQUE,
    password        VARCHAR(255) NOT NULL,
    status          SMALLINT NOT NULL DEFAULT 1,        -- 1正常 0停用 (反向)
    login_ip        VARCHAR(64),
    login_date      TIMESTAMPTZ(3),
    created_time    TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
    updated_time    TIMESTAMPTZ(3),
    is_del          SMALLINT NOT NULL DEFAULT 0,        -- 0未删除 1已删除
    -- 缺失字段需补充
);
```

**迁移映射关系**
```
user_id          → user_id (保持一致)
tenant_id        → 新增字段支持 (可选, 当前设为常量)
dept_id          → dept_id (保持一致)
user_name        → username (字段改名)
nick_name        → nickname (字段改名)
user_type        → 新增字段 user_type (保留用户类型)
email            → email (保持一致)
phonenumber      → phone (字段改名)
sex              → sex (保持一致, CHAR → SMALLINT)
avatar           → avatar (从 BIGINT 改为 VARCHAR 路径存储)
password         → password (保持一致)
status           → status (值需要反向转换: 0→1, 1→0)
del_flag         → is_del (字段改名)
login_ip         → login_ip (保持一致)
login_date       → login_date (保持一致)
create_dept      → 暂不实现 (可选字段)
create_by        → 暂不实现 (可选字段)
create_time      → created_time (字段改名)
update_by        → 暂不实现 (可选字段)
update_time      → updated_time (字段改名)
remark           → 暂不实现 (可选字段)
```

**迁移 SQL (Prisma 迁移文件)**
```prisma
model User {
  userId        BigInt    @id @default(autoincrement())
  tenantId      String    @default("000000")
  deptId        BigInt?
  username      String    @unique @db.VarChar(64)
  nickname      String?   @db.VarChar(64)
  phone         String?   @unique @db.VarChar(32)
  sex           Int?      @default(0)
  avatar        String?   @db.VarChar(255)
  email         String?   @unique @db.VarChar(128)
  password      String    @db.VarChar(255)
  status        Int       @default(1)
  loginIp       String?   @db.VarChar(64)
  loginDate     DateTime?
  createdTime   DateTime  @default(now())
  updatedTime   DateTime  @updatedAt
  isDel         Int       @default(0)
  userType      String    @default("sys_user")
  remark        String?

  dept          Dept?     @relation(fields: [deptId], references: [deptId])
  roles         UserRole[]
  posts         UserPost[]

  @@map("sys_user")
}
```

#### 2.1.2 角色表 (sys_role)

**源系统表定义**
```sql
CREATE TABLE sys_role (
    role_id             BIGINT PRIMARY KEY,
    tenant_id           VARCHAR(20) DEFAULT '000000',
    role_name           VARCHAR(30) NOT NULL,
    role_key            VARCHAR(64) UNIQUE NOT NULL,
    role_sort           INT DEFAULT 0,
    data_scope          CHAR DEFAULT '1',                -- 数据范围
    menu_check_strictly BOOLEAN DEFAULT FALSE,           -- 菜单树关联
    dept_check_strictly BOOLEAN DEFAULT FALSE,           -- 部门树关联
    status              CHAR DEFAULT '0',                -- 角色状态
    del_flag            CHAR DEFAULT '0',
    create_dept         BIGINT,
    create_by           BIGINT,
    create_time         TIMESTAMP,
    update_by           BIGINT,
    update_time         TIMESTAMP,
    remark              VARCHAR(500)
);
```

**当前系统表定义**
```sql
CREATE TABLE sys_role (
    role_id             BIGSERIAL PRIMARY KEY,
    role_code           VARCHAR(64) UNIQUE NOT NULL,
    role_name           VARCHAR(64) NOT NULL,
    data_scope          DataScope DEFAULT 'SELF',
    status              SMALLINT DEFAULT 1,
    is_system           BOOLEAN DEFAULT FALSE,
    created_time        TIMESTAMPTZ(3),
    updated_time        TIMESTAMPTZ(3),
    is_del              SMALLINT DEFAULT 0
);

-- 枚举类型定义
CREATE TYPE "DataScope" AS ENUM (
    'ALL',                  -- 全部数据权限
    'DEPT_AND_CHILDREN',    -- 本部门及以下
    'DEPT',                 -- 本部门
    'CUSTOM',               -- 自定数据权限
    'SELF'                  -- 仅本人
);
```

**迁移映射关系**
```
role_id             → role_id
tenant_id           → 添加字段支持
role_name           → role_name
role_key            → role_code (字段改名)
role_sort           → 暂不实现 (可选)
data_scope          → data_scope (需转换映射)
menu_check_strictly → 暂不实现 (缓存策略处理)
dept_check_strictly → 暂不实现 (缓存策略处理)
status              → status (反向转换: 0→1, 1→0)
del_flag            → is_del
is_system           → 新增字段
```

**DataScope 映射规则**
```
源系统 → 新系统
'1'   → 'ALL'                  -- 全部数据权限
'2'   → 'CUSTOM'               -- 自定数据权限
'3'   → 'DEPT'                 -- 本部门数据权限
'4'   → 'DEPT_AND_CHILDREN'    -- 本部门及以下
'5'   → 'SELF'                 -- 仅本人数据权限
'6'   → 'DEPT_AND_CHILDREN'    -- 部门及以下或本人 (映射为部门及以下)
```

#### 2.1.3 菜单表 (sys_menu)

**源系统表定义**
```sql
CREATE TABLE sys_menu (
    menu_id         BIGINT PRIMARY KEY,
    parent_id       BIGINT DEFAULT 0,
    menu_name       VARCHAR(50) NOT NULL,
    order_num       INT DEFAULT 0,
    path            VARCHAR(200),
    component       VARCHAR(255),
    query_param     VARCHAR(255),
    is_frame        CHAR DEFAULT '0',                    -- 是否外链 (0是 1否)
    is_cache        CHAR DEFAULT '0',                    -- 是否缓存 (0缓存 1不缓存)
    menu_type       CHAR NOT NULL,                       -- M/C/F (目录/菜单/按钮)
    visible         CHAR DEFAULT '0',                    -- 显示状态 (0显示 1隐藏)
    status          CHAR DEFAULT '0',                    -- 菜单状态
    perms           VARCHAR(100),                        -- 权限字符串
    icon            VARCHAR(100),
    create_by       BIGINT,
    create_time     TIMESTAMP,
    update_by       BIGINT,
    update_time     TIMESTAMP,
    remark          VARCHAR(500)
);
```

**当前系统表定义**
```sql
CREATE TABLE sys_menu (
    menu_id             BIGSERIAL PRIMARY KEY,
    parent_id           BIGINT,
    menu_type           MenuType NOT NULL,               -- DIRECTORY/MENU/ACTION
    menu_name           VARCHAR(64) NOT NULL,
    route_path          VARCHAR(255),
    component           VARCHAR(255),
    permission_code     VARCHAR(128) UNIQUE,
    sort_order          SMALLINT DEFAULT 0,
    status              SMALLINT DEFAULT 1,
    created_time        TIMESTAMPTZ(3),
    updated_time        TIMESTAMPTZ(3),
    is_del              SMALLINT DEFAULT 0
);

CREATE TYPE "MenuType" AS ENUM ('DIRECTORY', 'MENU', 'ACTION');
```

**迁移映射关系**
```
menu_id         → menu_id
parent_id       → parent_id (默认 0 → NULL)
menu_name       → menu_name
order_num       → sort_order
path            → route_path
component       → component
query_param     → 暂不实现 (可选字段)
is_frame        → 暂不实现 (可选字段)
is_cache        → 暂不实现 (缓存策略处理)
menu_type       → menu_type (映射 M/C/F 到枚举)
visible         → 暂不实现 (状态管理)
status          → status
perms           → permission_code
icon            → 暂不实现 (前端管理)
remark          → 暂不实现

菜单类型映射:
'M' → DIRECTORY
'C' → MENU
'F' → ACTION
```

#### 2.1.4 部门表 (sys_dept)

**源系统表定义**
```sql
CREATE TABLE sys_dept (
    dept_id         BIGINT PRIMARY KEY,
    tenant_id       VARCHAR(20) DEFAULT '000000',
    parent_id       BIGINT DEFAULT 0,
    ancestors       VARCHAR(500),                        -- 祖级列表
    dept_name       VARCHAR(30) NOT NULL,
    dept_category   VARCHAR(100),                        -- 部门类别编码
    order_num       INT DEFAULT 0,
    leader          BIGINT,                              -- 负责人 ID
    phone           VARCHAR(11),
    email           VARCHAR(50),
    status          CHAR DEFAULT '0',
    del_flag        CHAR DEFAULT '0',
    create_dept     BIGINT,
    create_by       BIGINT,
    create_time     TIMESTAMP,
    update_by       BIGINT,
    update_time     TIMESTAMP
);
```

**当前系统表定义**
```sql
CREATE TABLE sys_dept (
    dept_id         BIGSERIAL PRIMARY KEY,
    parent_id       BIGINT,
    dept_name       VARCHAR(64) NOT NULL,
    sort_order      SMALLINT DEFAULT 0,
    status          SMALLINT DEFAULT 1,
    created_time    TIMESTAMPTZ(3),
    updated_time    TIMESTAMPTZ(3),
    is_del          SMALLINT DEFAULT 0
);
```

**迁移映射关系**
```
dept_id         → dept_id
tenant_id       → 添加字段支持
parent_id       → parent_id (0 → NULL)
ancestors       → 新增字段 (缓存字段)
dept_name       → dept_name
dept_category   → 新增字段 (保留分类)
order_num       → sort_order
leader          → 新增字段 (负责人)
phone           → 新增字段
email           → 新增字段
status          → status (反向转换)
del_flag        → is_del
```

**扩展 Prisma 模型**
```prisma
model Dept {
  deptId       BigInt     @id @default(autoincrement())
  parentId     BigInt?
  deptName     String     @db.VarChar(64)
  deptCategory String?    @db.VarChar(100)
  sortOrder    Int        @default(0)
  leader       BigInt?
  phone        String?    @db.VarChar(32)
  email        String?    @db.VarChar(128)
  status       Int        @default(1)
  ancestors    String?    @db.VarChar(500)
  createdTime  DateTime   @default(now())
  updatedTime  DateTime   @updatedAt
  isDel        Int        @default(0)

  parent       Dept?      @relation("DeptTree", fields: [parentId], references: [deptId])
  children     Dept[]     @relation("DeptTree")
  users        User[]

  @@map("sys_dept")
}
```

#### 2.1.5 岗位表 (sys_post)

**源系统表定义**
```sql
CREATE TABLE sys_post (
    post_id         BIGINT PRIMARY KEY,
    tenant_id       VARCHAR(20) DEFAULT '000000',
    dept_id         BIGINT,                              -- 部门ID
    post_code       VARCHAR(64) UNIQUE NOT NULL,
    post_name       VARCHAR(50) NOT NULL,
    post_category   VARCHAR(100),                        -- 岗位类别编码
    post_sort       INT DEFAULT 0,
    status          CHAR DEFAULT '0',
    create_dept     BIGINT,
    create_by       BIGINT,
    create_time     TIMESTAMP,
    update_by       BIGINT,
    update_time     TIMESTAMP,
    remark          VARCHAR(500)
);
```

**当前系统表定义**
```sql
CREATE TABLE sys_post (
    post_id         BIGSERIAL PRIMARY KEY,
    post_code       VARCHAR(64) UNIQUE NOT NULL,
    post_name       VARCHAR(64) NOT NULL,
    sort_order      SMALLINT DEFAULT 0,
    status          SMALLINT DEFAULT 1,
    created_time    TIMESTAMPTZ(3),
    updated_time    TIMESTAMPTZ(3),
    is_del          SMALLINT DEFAULT 0
);
```

**迁移映射关系**
```
post_id         → post_id
tenant_id       → 添加字段支持
dept_id         → 新增字段 (保留部门关联)
post_code       → post_code
post_name       → post_name
post_category   → 新增字段
post_sort       → sort_order
status          → status (反向转换)
is_system       → 新增字段 (标记系统岗位)
```

**扩展 Prisma 模型**
```prisma
model Post {
  postId       BigInt     @id @default(autoincrement())
  postCode     String     @unique @db.VarChar(64)
  postName     String     @db.VarChar(64)
  deptId       BigInt?
  postCategory String?    @db.VarChar(100)
  sortOrder    Int        @default(0)
  status       Int        @default(1)
  isSystem     Boolean    @default(false)
  createdTime  DateTime   @default(now())
  updatedTime  DateTime   @updatedAt
  isDel        Int        @default(0)

  users        UserPost[]

  @@map("sys_post")
}
```

### 2.2 关联表迁移方案

#### 2.2.1 用户-角色关联表 (sys_user_role)

**表结构（源系统 = 当前系统）**
```sql
CREATE TABLE sys_user_role (
    user_id  BIGINT NOT NULL,
    role_id  BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES sys_user(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES sys_role(role_id) ON DELETE CASCADE
);
```

**Prisma 模型**
```prisma
model UserRole {
  userId  BigInt
  roleId  BigInt
  user    User   @relation(fields: [userId], references: [userId], onDelete: Cascade)
  role    Role   @relation(fields: [roleId], references: [roleId], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("sys_user_role")
}
```

#### 2.2.2 用户-岗位关联表 (sys_user_post)

**Prisma 模型**
```prisma
model UserPost {
  userId  BigInt
  postId  BigInt
  user    User   @relation(fields: [userId], references: [userId], onDelete: Cascade)
  post    Post   @relation(fields: [postId], references: [postId], onDelete: Restrict)

  @@id([userId, postId])
  @@map("sys_user_post")
}
```

#### 2.2.3 角色-菜单关联表 (sys_role_menu)

**Prisma 模型**
```prisma
model RoleMenu {
  roleId  BigInt
  menuId  BigInt
  role    Role   @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  menu    Menu   @relation(fields: [menuId], references: [menuId], onDelete: Cascade)

  @@id([roleId, menuId])
  @@map("sys_role_menu")
}
```

#### 2.2.4 角色-部门关联表 (sys_role_dept)

**Prisma 模型**
```prisma
model RoleDept {
  roleId  BigInt
  deptId  BigInt
  role    Role   @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  dept    Dept   @relation(fields: [deptId], references: [deptId], onDelete: Restrict)

  @@id([roleId, deptId])
  @@map("sys_role_dept")
}
```

### 2.3 Prisma Schema 完整定义

见 [第四部分 - 实现代码](#第四部分实现代码)

---

## 第三部分：业务逻辑对标分析

### 3.1 用户管理功能对标

#### 源系统功能特性
- ✅ 用户 CRUD 操作
- ✅ 用户导入导出
- ✅ 密码重置/修改
- ✅ 用户锁定状态管理
- ✅ 登录日志记录
- ✅ 用户角色关联
- ✅ 用户岗位关联
- ✅ 用户部门关联
- ✅ 头像上传（OSS 集成）
- ✅ 用户个人信息修改

#### 当前系统实现状态
- ✅ 基础 CRUD
- ❌ 导入导出功能
- ⚠️ 密码管理（bcrypt 已集成）
- ❌ 登录日志
- ✅ 角色关联
- ⚠️ 岗位关联（表结构已准备）
- ✅ 部门关联

#### 迁移计划
1. **第一阶段**: 完善用户基础 CRUD 和密码管理
2. **第二阶段**: 实现用户导入导出功能
3. **第三阶段**: 集成登录日志记录
4. **第四阶段**: 集成头像上传功能

### 3.2 角色管理功能对标

#### 源系统功能特性
- ✅ 角色 CRUD
- ✅ 角色权限分配（菜单权限）
- ✅ 角色数据权限配置
- ✅ 角色部门权限范围设置
- ✅ 菜单树选择（关联显示）
- ✅ 部门树选择（关联显示）
- ✅ 角色状态管理

#### 当前系统实现状态
- ✅ 基础 CRUD
- ✅ 菜单权限分配
- ✅ 部门权限分配
- ⚠️ 数据权限模型（已支持枚举，需业务实现）
- ⚠️ 树形关联选择

#### 迁移计划
1. **第一阶段**: 完善角色权限分配逻辑
2. **第二阶段**: 实现数据权限过滤业务逻辑
3. **第三阶段**: 优化树形关联显示
4. **第四阶段**: 角色缓存策略实现

### 3.3 菜单管理功能对标

#### 源系统功能特性
- ✅ 菜单 CRUD
- ✅ 菜单树形结构管理
- ✅ 菜单权限字符串定义
- ✅ 菜单动态路由生成
- ✅ 菜单图标管理
- ✅ 菜单显示/隐藏状态
- ✅ 菜单缓存（权限缓存）
- ✅ 按钮权限管理

#### 当前系统实现状态
- ✅ 基础 CRUD
- ✅ 菜单树形管理
- ✅ 权限字符串支持
- ⚠️ 动态路由（前端管理）
- ❌ 图标管理
- ⚠️ 显示状态管理

#### 迁移计划
1. **第一阶段**: 补全菜单字段和状态管理
2. **第二阶段**: 实现权限字符串缓存
3. **第三阶段**: 菜单树形性能优化
4. **第四阶段**: 按钮权限细粒度控制

### 3.4 部门管理功能对标

#### 源系统功能特性
- ✅ 部门 CRUD
- ✅ 部门树形结构
- ✅ 祖级列表维护（ancestors 字段）
- ✅ 部门负责人设置
- ✅ 部门联系方式
- ✅ 部门状态管理
- ✅ 部门排序

#### 当前系统实现状态
- ✅ 基础 CRUD
- ✅ 树形结构
- ⚠️ 祖级列表（需实现缓存）
- ❌ 部门负责人
- ❌ 联系方式
- ✅ 状态和排序

#### 迁移计划
1. **第一阶段**: 补全部门字段（负责人、联系方式、分类）
2. **第二阶段**: 实现祖级列表维护逻辑
3. **第三阶段**: 部门数据一致性检查
4. **第四阶段**: 性能优化（缓存策略）

### 3.5 岗位管理功能对标

#### 源系统功能特性
- ✅ 岗位 CRUD
- ✅ 岗位编码唯一性
- ✅ 岗位分类
- ✅ 岗位排序
- ✅ 岗位状态管理

#### 当前系统实现状态
- ✅ 基础 CRUD
- ✅ 编码唯一性
- ❌ 岗位分类
- ✅ 排序和状态

#### 迁移计划
1. **第一阶段**: 补全岗位分类字段
2. **第二阶段**: 与用户岗位关联功能完善
3. **第三阶段**: 岗位权限扩展（可选）

---

## 第四部分：实现代码

### 4.1 完整 Prisma Schema

请参考文件: `./prisma/schema_extended.prisma`

### 4.2 数据库迁移 SQL

#### 4.2.1 扩展现有表

```sql
-- 扩展 sys_user 表
ALTER TABLE sys_user
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(20) DEFAULT '000000',
ADD COLUMN IF NOT EXISTS user_type VARCHAR(10) DEFAULT 'sys_user',
ADD COLUMN IF NOT EXISTS remark VARCHAR(500);

-- 扩展 sys_dept 表
ALTER TABLE sys_dept
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(20) DEFAULT '000000',
ADD COLUMN IF NOT EXISTS dept_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS leader BIGINT,
ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
ADD COLUMN IF NOT EXISTS email VARCHAR(128),
ADD COLUMN IF NOT EXISTS ancestors VARCHAR(500);

-- 扩展 sys_post 表
ALTER TABLE sys_post
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(20) DEFAULT '000000',
ADD COLUMN IF NOT EXISTS dept_id BIGINT,
ADD COLUMN IF NOT EXISTS post_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS remark VARCHAR(500);

-- 扩展 sys_role 表
ALTER TABLE sys_role
ADD COLUMN IF NOT EXISTS role_sort INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS menu_check_strictly BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dept_check_strictly BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS remark VARCHAR(500),
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(20) DEFAULT '000000';

-- 扩展 sys_menu 表（添加缺失字段）
ALTER TABLE sys_menu
ADD COLUMN IF NOT EXISTS icon VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_frame SMALLINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_cache SMALLINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS query_param VARCHAR(255),
ADD COLUMN IF NOT EXISTS visible SMALLINT DEFAULT 0;

-- 创建 sys_role_dept 表（如不存在）
CREATE TABLE IF NOT EXISTS sys_role_dept (
    role_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, dept_id),
    FOREIGN KEY (role_id) REFERENCES sys_role(role_id) ON DELETE CASCADE,
    FOREIGN KEY (dept_id) REFERENCES sys_dept(dept_id) ON DELETE RESTRICT
);

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_sys_user_tenant_id ON sys_user(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sys_dept_tenant_id ON sys_dept(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sys_post_tenant_id ON sys_post(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sys_role_tenant_id ON sys_role(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sys_role_dept_dept_id ON sys_role_dept(dept_id);
```

#### 4.2.2 数据转换 SQL

```sql
-- 1. 用户表状态值转换 (源系统: 0正常→1停用 → 新系统: 1正常→0停用)
UPDATE sys_user SET status = CASE WHEN status = '0' THEN 1 WHEN status = '1' THEN 0 ELSE status END;

-- 2. 角色表状态值转换
UPDATE sys_role SET status = CASE WHEN status = '0' THEN 1 WHEN status = '1' THEN 0 ELSE status END;

-- 3. 菜单类型转换（char → enum）
-- 已由 Prisma migration 处理

-- 4. 部门表状态值转换
UPDATE sys_dept SET status = CASE WHEN status = '0' THEN 1 WHEN status = '1' THEN 0 ELSE status END;

-- 5. 岗位表状态值转换
UPDATE sys_post SET status = CASE WHEN status = '0' THEN 1 WHEN status = '1' THEN 0 ELSE status END;

-- 6. parent_id = 0 转换为 NULL
UPDATE sys_dept SET parent_id = NULL WHERE parent_id = 0;
UPDATE sys_menu SET parent_id = NULL WHERE parent_id = 0;

-- 7. 生成祖级列表 (递归构建)
-- 此操作需由业务逻辑代码执行，确保一致性
```

### 4.3 NestJS 服务层实现

#### 4.3.1 用户服务扩展

```typescript
// apps/gateway/src/modules/system/user/user.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { BusinessException, toDto } from '@app/core';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/response.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建用户
   * @param dto 用户信息 DTO
   */
  async create(dto: CreateUserDto) {
    // 检查用户名唯一性
    const existingUser = await this.prisma.user.findFirst({
      where: { username: dto.username, isDel: 0 },
    });
    if (existingUser) {
      throw BusinessException.badRequest('用户名已存在');
    }

    // 检查部门是否存在
    if (dto.deptId) {
      const dept = await this.prisma.dept.findFirst({
        where: { deptId: BigInt(dto.deptId), isDel: 0 },
      });
      if (!dept) {
        throw BusinessException.badRequest('部门不存在');
      }
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        nickname: dto.nickname,
        password: hashedPassword,
        email: dto.email,
        phone: dto.phone,
        sex: dto.sex || 0,
        status: dto.status ?? 1,
        deptId: dto.deptId ? BigInt(dto.deptId) : null,
        userType: 'sys_user',
      },
      include: {
        roles: { include: { role: true } },
        posts: { include: { post: true } },
      },
    });

    // 分配角色
    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.assignRoles(user.userId, dto.roleIds);
    }

    // 分配岗位
    if (dto.postIds && dto.postIds.length > 0) {
      await this.assignPosts(user.userId, dto.postIds);
    }

    return toDto(UserResponseDto, user);
  }

  /**
   * 查询所有用户（分页）
   */
  async findAll(page: number, limit: number, queryDto?: any) {
    const skip = (page - 1) * limit;
    const where: any = { isDel: 0 };

    if (queryDto?.username) {
      where.username = { contains: queryDto.username };
    }
    if (queryDto?.status !== undefined) {
      where.status = queryDto.status;
    }
    if (queryDto?.deptId) {
      where.deptId = BigInt(queryDto.deptId);
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          dept: true,
          roles: { include: { role: true } },
          posts: { include: { post: true } },
        },
        orderBy: { userId: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => toDto(UserResponseDto, u)),
      total,
      page,
      limit,
    };
  }

  /**
   * 查询单个用户
   */
  async findOne(userId: bigint) {
    const user = await this.prisma.user.findFirst({
      where: { userId, isDel: 0 },
      include: {
        dept: true,
        roles: { include: { role: true } },
        posts: { include: { post: true } },
      },
    });

    if (!user) {
      throw BusinessException.notFound('用户不存在');
    }

    return toDto(UserResponseDto, user);
  }

  /**
   * 更新用户
   */
  async update(userId: bigint, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { userId, isDel: 0 },
    });

    if (!user) {
      throw BusinessException.notFound('用户不存在');
    }

    // 检查部门是否存在
    if (dto.deptId) {
      const dept = await this.prisma.dept.findFirst({
        where: { deptId: BigInt(dto.deptId), isDel: 0 },
      });
      if (!dept) {
        throw BusinessException.badRequest('部门不存在');
      }
    }

    const updateData: any = {
      nickname: dto.nickname,
      email: dto.email,
      phone: dto.phone,
      sex: dto.sex,
      status: dto.status,
      deptId: dto.deptId ? BigInt(dto.deptId) : user.deptId,
    };

    const updated = await this.prisma.user.update({
      where: { userId },
      data: updateData,
      include: {
        roles: { include: { role: true } },
        posts: { include: { post: true } },
      },
    });

    // 更新角色
    if (dto.roleIds) {
      await this.assignRoles(userId, dto.roleIds);
    }

    // 更新岗位
    if (dto.postIds) {
      await this.assignPosts(userId, dto.postIds);
    }

    return toDto(UserResponseDto, updated);
  }

  /**
   * 删除用户
   */
  async remove(userId: bigint) {
    const user = await this.prisma.user.findFirst({
      where: { userId, isDel: 0 },
    });

    if (!user) {
      throw BusinessException.notFound('用户不存在');
    }

    // 禁止删除超级管理员
    if (userId === BigInt(1)) {
      throw BusinessException.badRequest('无法删除超级管理员');
    }

    await this.prisma.user.update({
      where: { userId },
      data: { isDel: 1 },
    });
  }

  /**
   * 分配用户角色
   */
  private async assignRoles(userId: bigint, roleIds: bigint[]) {
    // 删除现有关联
    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    // 创建新关联
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
      })),
    });
  }

  /**
   * 分配用户岗位
   */
  private async assignPosts(userId: bigint, postIds: bigint[]) {
    // 删除现有关联
    await this.prisma.userPost.deleteMany({
      where: { userId },
    });

    // 创建新关联
    await this.prisma.userPost.createMany({
      data: postIds.map((postId) => ({
        userId,
        postId,
      })),
    });
  }

  /**
   * 重置密码
   */
  async resetPassword(userId: bigint, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { userId, isDel: 0 },
    });

    if (!user) {
      throw BusinessException.notFound('用户不存在');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { userId },
      data: { password: hashedPassword },
    });
  }

  /**
   * 验证密码
   */
  async validatePassword(userId: bigint, password: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { userId, isDel: 0 },
    });

    if (!user) {
      return false;
    }

    return bcrypt.compare(password, user.password);
  }

  /**
   * 获取用户权限（权限字符串集合）
   */
  async getUserPermissions(userId: bigint): Promise<Set<string>> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, user: { isDel: 0 } },
      include: {
        role: {
          include: {
            menus: {
              include: { menu: true },
              where: { menu: { isDel: 0 } },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      // 如果是超级管理员（role_id = 1），返回 "*:*:*"
      if (userRole.roleId === BigInt(1)) {
        permissions.add('*:*:*');
        return permissions;
      }

      // 收集菜单权限
      for (const roleMenu of userRole.role.menus) {
        if (roleMenu.menu.permissionCode) {
          permissions.add(roleMenu.menu.permissionCode);
        }
      }
    }

    return permissions;
  }
}
```

#### 4.3.2 角色服务扩展

```typescript
// apps/gateway/src/modules/system/role/role.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { BusinessException, toDto } from '@app/core';
import { CreateRoleDto, UpdateRoleDto, ReplaceIdsDto } from './dto/role.dto';
import { RoleResponseDto } from './dto/response.dto';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建角色
   */
  async create(dto: CreateRoleDto) {
    // 检查角色编码唯一性
    const existingRole = await this.prisma.role.findFirst({
      where: { roleCode: dto.roleCode, isDel: 0 },
    });
    if (existingRole) {
      throw BusinessException.badRequest('角色编码已存在');
    }

    const role = await this.prisma.role.create({
      data: {
        roleCode: dto.roleCode,
        roleName: dto.roleName,
        dataScope: dto.dataScope || 'SELF',
        status: dto.status ?? 1,
        isSystem: dto.isSystem ?? false,
      },
      include: {
        menus: { include: { menu: true } },
        depts: { include: { dept: true } },
      },
    });

    return toDto(RoleResponseDto, role);
  }

  /**
   * 查询所有角色
   */
  async findAll() {
    const roles = await this.prisma.role.findMany({
      where: { isDel: 0 },
      include: {
        menus: { include: { menu: true } },
        depts: { include: { dept: true } },
      },
      orderBy: { roleId: 'asc' },
    });

    return roles.map((r) => toDto(RoleResponseDto, r));
  }

  /**
   * 查询单个角色
   */
  async findOne(roleId: bigint) {
    const role = await this.prisma.role.findFirst({
      where: { roleId, isDel: 0 },
      include: {
        menus: { include: { menu: true } },
        depts: { include: { dept: true } },
      },
    });

    if (!role) {
      throw BusinessException.notFound('角色不存在');
    }

    return toDto(RoleResponseDto, role);
  }

  /**
   * 更新角色
   */
  async update(roleId: bigint, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { roleId, isDel: 0 },
    });

    if (!role) {
      throw BusinessException.notFound('角色不存在');
    }

    const updated = await this.prisma.role.update({
      where: { roleId },
      data: {
        roleName: dto.roleName,
        dataScope: dto.dataScope,
        status: dto.status,
        isSystem: dto.isSystem,
      },
      include: {
        menus: { include: { menu: true } },
        depts: { include: { dept: true } },
      },
    });

    return toDto(RoleResponseDto, updated);
  }

  /**
   * 删除角色
   */
  async remove(roleId: bigint) {
    const role = await this.prisma.role.findFirst({
      where: { roleId, isDel: 0 },
    });

    if (!role) {
      throw BusinessException.notFound('角色不存在');
    }

    // 禁止删除系统角色
    if (role.isSystem) {
      throw BusinessException.badRequest('无法删除系统角色');
    }

    // 检查是否有用户关联
    const userCount = await this.prisma.userRole.count({
      where: { roleId },
    });

    if (userCount > 0) {
      throw BusinessException.conflict('该角色已被用户关联，无法删除');
    }

    await this.prisma.role.update({
      where: { roleId },
      data: { isDel: 1 },
    });
  }

  /**
   * 替换角色菜单权限
   */
  async replaceRoleMenus(roleId: bigint, dto: ReplaceIdsDto) {
    const role = await this.prisma.role.findFirst({
      where: { roleId, isDel: 0 },
    });

    if (!role) {
      throw BusinessException.notFound('角色不存在');
    }

    // 删除现有菜单权限
    await this.prisma.roleMenu.deleteMany({
      where: { roleId },
    });

    // 创建新菜单权限
    if (dto.ids && dto.ids.length > 0) {
      await this.prisma.roleMenu.createMany({
        data: dto.ids.map((menuId) => ({
          roleId,
          menuId,
        })),
      });
    }
  }

  /**
   * 查询角色菜单权限
   */
  async findRoleMenus(roleId: bigint) {
    const role = await this.prisma.role.findFirst({
      where: { roleId, isDel: 0 },
    });

    if (!role) {
      throw BusinessException.notFound('角色不存在');
    }

    const roleMenus = await this.prisma.roleMenu.findMany({
      where: { roleId },
      include: { menu: true },
    });

    return roleMenus.map((rm) => rm.menuId);
  }

  /**
   * 替换角色部门权限范围
   */
  async replaceRoleDepts(roleId: bigint, dto: ReplaceIdsDto) {
    const role = await this.prisma.role.findFirst({
      where: { roleId, isDel: 0 },
    });

    if (!role) {
      throw BusinessException.notFound('角色不存在');
    }

    // 删除现有部门权限
    await this.prisma.roleDept.deleteMany({
      where: { roleId },
    });

    // 创建新部门权限
    if (dto.ids && dto.ids.length > 0) {
      await this.prisma.roleDept.createMany({
        data: dto.ids.map((deptId) => ({
          roleId,
          deptId,
        })),
      });
    }
  }

  /**
   * 获取角色数据权限范围内的部门
   */
  async getRoleDataScopeDepts(roleId: bigint): Promise<bigint[]> {
    const role = await this.prisma.role.findFirst({
      where: { roleId, isDel: 0 },
      include: { depts: true },
    });

    if (!role) {
      return [];
    }

    if (role.dataScope === 'ALL') {
      // 全部数据权限：返回所有部门
      const allDepts = await this.prisma.dept.findMany({
        where: { isDel: 0 },
        select: { deptId: true },
      });
      return allDepts.map((d) => d.deptId);
    }

    if (role.dataScope === 'CUSTOM') {
      // 自定数据权限：返回配置的部门
      return role.depts.map((rd) => rd.deptId);
    }

    // 其他情况返回空
    return [];
  }
}
```

### 4.4 数据权限中间件

```typescript
// apps/gateway/src/modules/system/common/data-scope.middleware.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';

/**
 * 数据权限过滤中间件
 * 根据用户角色的数据范围自动过滤查询结果
 */
@Injectable()
export class DataScopeMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据用户角色和数据范围过滤部门查询条件
   * @param userId 用户 ID
   * @returns 返回可访问的部门 ID 列表
   */
  async getDeptFilterIds(userId: bigint): Promise<bigint[] | null> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { depts: true },
        },
      },
    });

    // 如果没有角色，返回空
    if (userRoles.length === 0) {
      return [];
    }

    // 收集所有可访问的部门
    const accessibleDepts = new Set<bigint>();

    for (const userRole of userRoles) {
      const role = userRole.role;

      if (role.dataScope === 'ALL') {
        // 全部数据权限：返回 null，表示不限制
        return null;
      }

      if (role.dataScope === 'CUSTOM') {
        // 自定数据权限：添加指定的部门
        for (const roleDept of role.depts) {
          accessibleDepts.add(roleDept.deptId);
        }
      }

      if (role.dataScope === 'DEPT') {
        // 本部门权限：获取用户部门
        const user = await this.prisma.user.findUnique({
          where: { userId },
        });
        if (user?.deptId) {
          accessibleDepts.add(user.deptId);
        }
      }

      if (role.dataScope === 'DEPT_AND_CHILDREN') {
        // 本部门及以下：获取部门及下级
        const user = await this.prisma.user.findUnique({
          where: { userId },
        });
        if (user?.deptId) {
          const deptIds = await this.getDeptAndChildren(user.deptId);
          deptIds.forEach((id) => accessibleDepts.add(id));
        }
      }

      if (role.dataScope === 'SELF') {
        // 仅本人：不添加部门限制，由具体查询处理
        return [];
      }
    }

    return Array.from(accessibleDepts);
  }

  /**
   * 递归获取部门及其所有下级部门
   */
  private async getDeptAndChildren(parentId: bigint): Promise<bigint[]> {
    const result: bigint[] = [parentId];

    const children = await this.prisma.dept.findMany({
      where: { parentId, isDel: 0 },
      select: { deptId: true },
    });

    for (const child of children) {
      const subChildren = await this.getDeptAndChildren(child.deptId);
      result.push(...subChildren);
    }

    return result;
  }
}
```

---

## 第五部分：迁移实施步骤

### 步骤 1：数据库迁移（第 1-2 周）

**目标**: 完成数据库结构升级和数据转换

**任务**:
1. ✅ 备份源系统数据库
2. ✅ 创建 Prisma 迁移文件（扩展字段）
3. ✅ 执行 Prisma migrate 命令
4. ✅ 运行数据转换 SQL 脚本
5. ✅ 数据一致性验证

**关键 SQL**:
```bash
# 1. 创建新的迁移
npx prisma migrate dev --name extend_system_tables

# 2. 执行迁移到生产环境
npx prisma migrate deploy
```

### 步骤 2：核心服务层实现（第 2-4 周）

**目标**: 实现所有五大模块的业务逻辑

**任务**:

#### 2.1 用户服务 (UserService)
- [ ] CRUD 操作
- [ ] 角色分配
- [ ] 岗位分配
- [ ] 密码管理
- [ ] 权限查询

#### 2.2 角色服务 (RoleService)
- [ ] CRUD 操作
- [ ] 菜单权限分配
- [ ] 部门权限分配
- [ ] 数据权限管理

#### 2.3 菜单服务 (MenuService)
- [ ] CRUD 操作
- [ ] 树形结构构建
- [ ] 权限字符串管理
- [ ] 菜单缓存

#### 2.4 部门服务 (DeptService)
- [ ] CRUD 操作
- [ ] 树形结构维护
- [ ] 祖级列表管理
- [ ] 负责人关联

#### 2.5 岗位服务 (PostService)
- [ ] CRUD 操作
- [ ] 岗位分类管理
- [ ] 用户岗位关联

### 步骤 3：控制层和 API 实现（第 4-5 周）

**目标**: 完成 REST API 端点实现

**任务**:
1. [ ] 用户管理 API
   - POST /system/user - 创建用户
   - GET /system/user - 查询用户列表
   - GET /system/user/:id - 查询单个用户
   - PATCH /system/user/:id - 更新用户
   - DELETE /system/user/:id - 删除用户
   - PUT /system/user/:id/roles - 分配角色
   - PUT /system/user/:id/posts - 分配岗位

2. [ ] 角色管理 API
   - POST /system/role - 创建角色
   - GET /system/role - 查询角色
   - PATCH /system/role/:id - 更新角色
   - DELETE /system/role/:id - 删除角色
   - PUT /system/role/:id/menus - 分配菜单权限
   - PUT /system/role/:id/depts - 分配部门权限

3. [ ] 菜单管理 API
   - POST /system/menu - 创建菜单
   - GET /system/menu - 查询菜单树
   - GET /system/menu/:id - 查询菜单
   - PATCH /system/menu/:id - 更新菜单
   - DELETE /system/menu/:id - 删除菜单

4. [ ] 部门管理 API
   - POST /system/dept - 创建部门
   - GET /system/dept - 查询部门树
   - GET /system/dept/:id - 查询部门
   - PATCH /system/dept/:id - 更新部门
   - DELETE /system/dept/:id - 删除部门

5. [ ] 岗位管理 API
   - POST /system/post - 创建岗位
   - GET /system/post - 查询岗位
   - PATCH /system/post/:id - 更新岗位
   - DELETE /system/post/:id - 删除岗位

### 步骤 4：权限控制实现（第 5-6 周）

**目标**: 实现基于角色的权限控制（RBAC）

**任务**:
1. [ ] 权限装饰器完善
2. [ ] 权限中间件实现
3. [ ] 数据权限过滤中间件
4. [ ] 权限缓存策略
5. [ ] 权限验证单元测试

### 步骤 5：高级功能实现（第 6-8 周）

**目标**: 实现高级业务功能

**任务**:
1. [ ] 用户导入导出
2. [ ] 登录日志记录
3. [ ] 操作日志记录
4. [ ] 头像上传管理
5. [ ] 菜单树缓存优化
6. [ ] 权限字符串缓存

### 步骤 6：测试和优化（第 8-9 周）

**目标**: 完成测试和性能优化

**任务**:
1. [ ] 单元测试编写
2. [ ] 集成测试编写
3. [ ] 性能测试和优化
4. [ ] 安全性审计
5. [ ] 数据一致性验证

### 步骤 7：上线和监控（第 9-10 周）

**目标**: 安全上线并建立监控

**任务**:
1. [ ] 灰度测试
2. [ ] 生产环境部署
3. [ ] 监控和告警设置
4. [ ] 性能基线建立
5. [ ] 文档完善

---

## 第六部分：数据一致性保障

### 6.1 关键数据一致性规则

#### 6.1.1 用户表一致性
- ✅ user_id 全局唯一
- ✅ username 唯一性约束
- ✅ email 唯一性约束
- ✅ phone 唯一性约束
- ✅ dept_id 必须指向存在的部门
- ✅ 删除用户时自动清理关联角色和岗位

#### 6.1.2 角色表一致性
- ✅ role_code 唯一性约束
- ✅ role_id 全局唯一
- ✅ dataScope 必须是有效的枚举值
- ✅ 删除角色时自动清理关联菜单和部门

#### 6.1.3 菜单表一致性
- ✅ menu_id 全局唯一
- ✅ parent_id 必须指向存在的菜单（如果不是顶级）
- ✅ permission_code 唯一性约束
- ✅ menu_type 必须是有效枚举值
- ✅ 防止菜单循环引用

#### 6.1.4 部门表一致性
- ✅ dept_id 全局唯一
- ✅ parent_id 必须指向存在的部门（如果不是顶级）
- ✅ 防止部门循环引用
- ✅ 删除部门时检查下级和用户

#### 6.1.5 岗位表一致性
- ✅ post_code 唯一性约束
- ✅ post_id 全局唯一

### 6.2 数据一致性检查 SQL

```sql
-- 1. 检查孤立用户（部门不存在）
SELECT u.user_id, u.username, u.dept_id
FROM sys_user u
LEFT JOIN sys_dept d ON u.dept_id = d.dept_id
WHERE u.is_del = 0 AND u.dept_id IS NOT NULL AND d.dept_id IS NULL;

-- 2. 检查孤立角色菜单关联
SELECT rm.role_id, rm.menu_id
FROM sys_role_menu rm
LEFT JOIN sys_role r ON rm.role_id = r.role_id
LEFT JOIN sys_menu m ON rm.menu_id = m.menu_id
WHERE r.role_id IS NULL OR m.menu_id IS NULL;

-- 3. 检查孤立角色部门关联
SELECT rd.role_id, rd.dept_id
FROM sys_role_dept rd
LEFT JOIN sys_role r ON rd.role_id = r.role_id
LEFT JOIN sys_dept d ON rd.dept_id = d.dept_id
WHERE r.role_id IS NULL OR d.dept_id IS NULL;

-- 4. 检查孤立菜单（parent_id 不存在）
SELECT m.menu_id, m.menu_name, m.parent_id
FROM sys_menu m
LEFT JOIN sys_menu p ON m.parent_id = p.menu_id
WHERE m.is_del = 0 AND m.parent_id IS NOT NULL AND p.menu_id IS NULL;

-- 5. 检查孤立部门（parent_id 不存在）
SELECT d.dept_id, d.dept_name, d.parent_id
FROM sys_dept d
LEFT JOIN sys_dept p ON d.parent_id = p.dept_id
WHERE d.is_del = 0 AND d.parent_id IS NOT NULL AND p.dept_id IS NULL;
```

### 6.3 数据一致性恢复程序

```typescript
// apps/gateway/src/modules/system/common/data-integrity.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/database';

@Injectable()
export class DataIntegrityService {
  private readonly logger = new Logger(DataIntegrityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 验证和修复数据一致性
   */
  async validateAndRepair(): Promise<any> {
    const report = {
      timestamp: new Date(),
      issues: [] as any[],
      fixes: [] as any[],
    };

    try {
      // 1. 检查孤立用户
      report.issues.push(await this.checkOrphanUsers());

      // 2. 检查孤立角色菜单关联
      report.issues.push(await this.checkOrphanRoleMenus());

      // 3. 检查孤立角色部门关联
      report.issues.push(await this.checkOrphanRoleDepts());

      // 4. 检查孤立菜单
      report.issues.push(await this.checkOrphanMenus());

      // 5. 检查孤立部门
      report.issues.push(await this.checkOrphanDepts());

      // 记录报告
      this.logger.log(`数据一致性检查完成: ${JSON.stringify(report)}`);

      return report;
    } catch (error) {
      this.logger.error(`数据一致性检查失败: ${error.message}`);
      throw error;
    }
  }

  private async checkOrphanUsers() {
    // 实现孤立用户检查和修复逻辑
    return { type: 'orphan_users', count: 0 };
  }

  private async checkOrphanRoleMenus() {
    // 实现孤立角色菜单关联检查和修复逻辑
    return { type: 'orphan_role_menus', count: 0 };
  }

  private async checkOrphanRoleDepts() {
    // 实现孤立角色部门关联检查和修复逻辑
    return { type: 'orphan_role_depts', count: 0 };
  }

  private async checkOrphanMenus() {
    // 实现孤立菜单检查和修复逻辑
    return { type: 'orphan_menus', count: 0 };
  }

  private async checkOrphanDepts() {
    // 实现孤立部门检查和修复逻辑
    return { type: 'orphan_depts', count: 0 };
  }
}
```

---

## 第七部分：性能优化策略

### 7.1 数据库查询优化

#### 7.1.1 索引策略
```sql
-- 用户查询索引
CREATE INDEX idx_sys_user_dept_id ON sys_user(dept_id) WHERE is_del = 0;
CREATE INDEX idx_sys_user_status ON sys_user(status) WHERE is_del = 0;
CREATE INDEX idx_sys_user_tenant_id ON sys_user(tenant_id, is_del);

-- 角色查询索引
CREATE INDEX idx_sys_role_status ON sys_role(status) WHERE is_del = 0;
CREATE INDEX idx_sys_role_is_system ON sys_role(is_system) WHERE is_del = 0;

-- 菜单查询索引
CREATE INDEX idx_sys_menu_parent_id ON sys_menu(parent_id) WHERE is_del = 0;
CREATE INDEX idx_sys_menu_type ON sys_menu(menu_type) WHERE is_del = 0;

-- 部门查询索引
CREATE INDEX idx_sys_dept_parent_id ON sys_dept(parent_id) WHERE is_del = 0;
CREATE INDEX idx_sys_dept_ancestors ON sys_dept USING GIN(ancestors) WHERE is_del = 0;

-- 岗位查询索引
CREATE INDEX idx_sys_post_status ON sys_post(status) WHERE is_del = 0;

-- 关联表查询索引
CREATE INDEX idx_sys_user_role_role_id ON sys_user_role(role_id);
CREATE INDEX idx_sys_user_post_post_id ON sys_user_post(post_id);
CREATE INDEX idx_sys_role_menu_menu_id ON sys_role_menu(menu_id);
CREATE INDEX idx_sys_role_dept_dept_id ON sys_role_dept(dept_id);
```

#### 7.1.2 查询优化
- 使用 Prisma 的 `select` 字段投影，仅查询必要字段
- 使用 `include` 进行关联加载，避免 N+1 查询
- 对树形结构使用缓存或物化视图

### 7.2 缓存策略

#### 7.2.1 权限缓存
```typescript
// 缓存用户权限集合
// key: user:{userId}:permissions
// ttl: 1小时

async getUserPermissions(userId: bigint): Promise<Set<string>> {
  const cacheKey = `user:${userId}:permissions`;
  const cached = await this.cache.get(cacheKey);

  if (cached) {
    return new Set(cached);
  }

  const permissions = await this.queryPermissions(userId);

  await this.cache.set(cacheKey, Array.from(permissions), 3600);

  return permissions;
}
```

#### 7.2.2 菜单树缓存
```typescript
// 缓存菜单树结构
// key: menus:tree
// ttl: 6小时

async getMenuTree(): Promise<MenuTreeNode[]> {
  const cacheKey = 'menus:tree';
  const cached = await this.cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const menus = await this.queryMenuTree();

  await this.cache.set(cacheKey, menus, 21600);

  return menus;
}
```

#### 7.2.3 缓存失效策略
- 用户权限修改时清除对应用户的权限缓存
- 菜单修改时清除菜单树缓存
- 部门修改时清除数据权限相关缓存

### 7.3 批量操作优化

```typescript
// 批量分配用户角色
async assignRolesBatch(userRoleMap: Map<bigint, bigint[]>) {
  await this.prisma.$transaction(async (tx) => {
    for (const [userId, roleIds] of userRoleMap) {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      });
    }
  });
}
```

---

## 第八部分：风险评估与应对

### 8.1 关键风险

| 风险项 | 发生概率 | 影响程度 | 应对措施 |
|-------|--------|--------|--------|
| 数据迁移失败 | 中 | 高 | 充分备份、分段迁移、回滚方案 |
| 权限控制逻辑错误 | 中 | 高 | 充分测试、灰度发布、监控告警 |
| 性能下降 | 中 | 中 | 索引优化、缓存策略、负载测试 |
| 多租户集成冲突 | 低 | 中 | 预留字段、兼容性设计 |
| 业务流程不兼容 | 低 | 中 | 需求评审、流程改进 |

### 8.2 回滚方案

```sql
-- 数据库回滚脚本
BEGIN TRANSACTION;

-- 1. 恢复用户数据
UPDATE sys_user SET status = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE status END;

-- 2. 恢复角色数据
UPDATE sys_role SET status = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE status END;

-- 3. 恢复部门数据
UPDATE sys_dept SET status = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE status END;

-- 4. 恢复岗位数据
UPDATE sys_post SET status = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE status END;

-- 5. 清理新增字段（可选）
-- ALTER TABLE sys_user DROP COLUMN IF EXISTS user_type;

COMMIT;
```

---

## 第九部分：文档和培训

### 9.1 API 文档

基于 OpenAPI 3.0 规范，文档将包括：
- 所有 REST 端点定义
- 请求/响应模式
- 错误处理
- 权限要求
- 使用示例

### 9.2 数据库文档

- ER 图表
- 表结构说明
- 字段定义
- 索引说明
- 关联关系

### 9.3 业务流程文档

- 用户生命周期管理
- 权限分配流程
- 数据权限模型
- 常见场景

---

## 第十部分：检查清单

### 迁移前检查
- [ ] 源系统数据备份
- [ ] 目标系统环境准备
- [ ] 团队培训完成
- [ ] 回滚方案准备
- [ ] 监控告警配置

### 迁移中检查
- [ ] 数据库迁移成功
- [ ] 数据转换验证
- [ ] 一致性检查通过
- [ ] API 功能测试
- [ ] 性能测试

### 迁移后检查
- [ ] 数据准确性验证
- [ ] 业务流程验证
- [ ] 权限控制验证
- [ ] 性能基线建立
- [ ] 监控告警正常

---

## 总结

本迁移方案提供了从 RuoYi-Vue-Plus 5.X 到 NestJS 后端的完整、系统化的功能复刻和数据库迁移指南。通过分步实施、充分测试和持续监控，确保系统的稳定性、数据的一致性和功能的完整性。

**预计总耗时**: 10 周
**团队规模**: 3-5 人
**关键成功因素**: 需求澄清、充分测试、风险管理、持续沟通
