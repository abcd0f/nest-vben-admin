# RBAC A 包约定（阶段 0～1）

本文件固定后续建表和接口实现的业务契约。A 包不建表，也不开放登录或管理重置密码的 HTTP 接口。B～E 包必须遵守以下规则；首次生产发布需同时完成认证与授权保护。

## 组织与数据范围

- 部门是单父节点树，根节点 `parent_id = NULL`；移动节点时拒绝自己或后代成为父节点。部门有子节点或用户引用时拒绝删除。停用不级联子部门，但停用部门不可再分配给用户；已有归属保留。
- 用户恰有零或一个主部门，可有多个岗位和角色。岗位只用于资料和筛选，不授予角色或权限。
- 部门、岗位、角色、菜单采用软删除；查询、授权和新增关联均排除已删除或停用记录。编码在含软删除记录的全表保持唯一，不复用。部门/岗位被引用时拒绝删除；角色/菜单删除前需清理关联，并保护系统角色和最后一个有效授权管理员。
- 用户、部门等所有 `BigInt` ID 在 HTTP 请求和响应中均为正整数十进制字符串，不经 JS `number` 转换。

| `data_scope` | 允许的数据 | 特殊条件 |
| --- | --- | --- |
| `ALL` | 全部 | 无 |
| `DEPT_AND_CHILDREN` | 用户主部门及其有效后代 | 用户无主部门时为空 |
| `DEPT` | 用户主部门 | 用户无主部门时为空 |
| `CUSTOM` | `sys_role_dept` 指定的有效部门 | 改为其他范围时事务内清空旧关联 |
| `SELF` | 负责人/创建人为当前用户的记录 | 必须由业务资源定义归属字段，不能用 `dept_id` 代替 |

对一次操作，只选取**授予该操作权限码的有效角色**，合并这些角色的数据范围（并集）；没有匹配角色则 403。列表、详情、修改、删除、导出和目标部门变更均在服务端按同一范围判定。资源没有可判定的部门/负责人字段时默认拒绝，需单独制定特例。

## 认证与管理边界

- 密码用带随机盐的 `scrypt` 哈希存储；旧明文统一强制重置，不支持明文回退验证。重置脚本只修改 `sys_user.password`，不删除用户。重置后旧密码失效；管理员通过受控重置流程设置新密码。
- 管理员重置他人密码与用户修改自己的密码是不同操作。前者需 `system:user:reset-password` 和系统管理员身份；后者需认证、当前密码和请求身份中的本人 ID。通用 `PATCH /system/user/:userId` 不接受密码。两种 HTTP 流程均在 E 包 Guard 生效后开放。
- 初始管理员由部署者显式给出现有用户 ID，初始化脚本只给该用户绑定系统管理员角色，不写死账号或密码。仅有效系统管理员可分配角色、数据范围、菜单；不允许通过这些操作给自己扩权。最后一个有效授权管理员及系统角色不能被停用、解绑或删除。
- 首期访问令牌有效期 8 小时，不续期；退出仅客户端丢弃令牌，因此已签发令牌在到期前仍可能被使用。每次请求重新检查用户/角色/菜单状态及授权，不缓存权限；用户停用、软删除和撤权下一次请求生效。令牌签名密钥由部署配置提供。

## 权限码目录

一个受保护的 API 对应一个稳定权限码。目录和页面菜单不授予 API 权限，只有启用的操作项可授权。登录公开；`/auth/me`、自助改密、退出只要求认证。未声明权限的业务接口默认拒绝。下表也是 B～E 包新增接口的命名契约，新增或改名时同步更新菜单初始化数据和 Guard 声明。

| 接口 | 权限码 |
| --- | --- |
| `GET /system/user` | `system:user:list` |
| `GET /system/user/:userId` | `system:user:query` |
| `POST /system/user` | `system:user:create` |
| `PATCH /system/user/:userId` | `system:user:update` |
| `DELETE /system/user/:userId` | `system:user:delete` |
| `PATCH /system/user/:userId/password/reset` | `system:user:reset-password` |
| `PUT /system/user/:userId/posts` | `system:user:assign-posts` |
| `PUT /system/user/:userId/roles` | `system:user:assign-roles` |
| `GET /system/dept` | `system:dept:list` |
| `GET /system/dept/:deptId` | `system:dept:query` |
| `POST /system/dept` | `system:dept:create` |
| `PATCH /system/dept/:deptId` | `system:dept:update` |
| `DELETE /system/dept/:deptId` | `system:dept:delete` |
| `GET /system/post` | `system:post:list` |
| `GET /system/post/:postId` | `system:post:query` |
| `POST /system/post` | `system:post:create` |
| `PATCH /system/post/:postId` | `system:post:update` |
| `DELETE /system/post/:postId` | `system:post:delete` |
| `GET /system/role` | `system:role:list` |
| `GET /system/role/:roleId` | `system:role:query` |
| `POST /system/role` | `system:role:create` |
| `PATCH /system/role/:roleId` | `system:role:update` |
| `DELETE /system/role/:roleId` | `system:role:delete` |
| `PUT /system/role/:roleId/depts` | `system:role:assign-depts` |
| `PUT /system/role/:roleId/menus` | `system:role:assign-menus` |
| `GET /system/menu` | `system:menu:list` |
| `GET /system/menu/:menuId` | `system:menu:query` |
| `POST /system/menu` | `system:menu:create` |
| `PATCH /system/menu/:menuId` | `system:menu:update` |
| `DELETE /system/menu/:menuId` | `system:menu:delete` |

## 现有部门 ID 映射与密码重置

阶段 2 迁移前，导出 `SELECT user_id, dept_id FROM sys_user WHERE dept_id IS NOT NULL`，保留原值和用户数。部署者提供旧 `dept_id` 到新 `sys_dept.dept_id` 的逐值映射；一对多旧值或无法映射值先列为异常并人工处理。迁移脚本校验所有非空旧值均有映射，再回填、取消唯一约束并加外键；不能直接强转或把异常值清空。迁移前后比对用户数、`user_id`、用户名和原始部门映射，空库与有数据测试库都演练。

发布阶段 1 代码前，在隔离备份上演练旧密码重置，统计待重置行数并核对用户数。通过显式 `RESET_DATABASE_URL` 指向目标 PostgreSQL 后，执行 `node --experimental-strip-types script/reset-legacy-passwords.mjs` 预览，再执行 `node --experimental-strip-types script/reset-legacy-passwords.mjs --apply`。脚本逐行写入随机不可知密码的哈希，事务提交且可重复运行；对已符合当前哈希格式的记录不修改。重置后再次预览应为 0，并抽样验证旧密码不能通过 `verifyPassword`。

管理员对指定用户离线重置时，在受控终端设置临时 `RESET_NEW_PASSWORD` 环境变量，执行 `node --experimental-strip-types script/set-user-password.mjs <userId>`，然后立即清除该变量。密码不得作为命令行参数或写入日志。两种脚本都显式指定目标库并读取 URL 中的 `schema` 参数。在 E 包认证和受保护的重置接口上线前，不对外开放旧账号登录和 HTTP 密码重置。
