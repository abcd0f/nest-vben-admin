# RuoYi-Vue-Plus 五个系统管理模块迁移方案

## 1. 文档目的

本文以 [RuoYi-Vue-Plus 5.6.2](E:\test\nest-vben-admin\RuoYi-Vue-Plus-5.X) 的用户、角色、菜单、部门、岗位模块为目标，对照当前 NestJS + Prisma 项目，定义数据库对齐范围、行为差距、依赖顺序、迁移步骤和逐步验收标准。阶段 0 的实施结果与复现命令见 [阶段 0 基线说明](ruoyi/phase0/README.md)；阶段 1 的离线准备和限制见 [阶段 1 说明](ruoyi/phase1/README.md)。

目标是把五个模块的数据库结构和可观察业务行为对齐到目标版本，同时保留当前 PostgreSQL 数据。验收依据为目标项目 PostgreSQL DDL 和 Java 服务实现，不把 RuoYi 的 MySQL 方言直接复制到当前数据库。

### 实施裁决（2026-10-16）

- 按用户要求直接替换现有实现，不保留旧 API、旧 DTO、旧权限模型、旧状态编码或旧密码验证路径；现有数据的离线盘点、备份和显式转换不构成运行时兼容。
- 1:1 指目标 PostgreSQL 结构及目标 Controller → Service → Mapper → BO/VO 的可观察规则。保留 NestJS、Prisma、PostgreSQL 技术栈，HTTP BIGINT 继续使用十进制字符串。
- 以目标源码实际覆盖为准，包括 5.7.8 中的对象范围覆盖差异和会话失效时机；不额外补充权限检查、统一会话失效、最后管理员保护或并发唯一性锁。未来如需增强，另行提出独立需求。
- 本次实施范围为阶段 0。该阶段只读取现有库，DDL 重放和恢复操作使用自动创建并清理的隔离数据库，不修改现有业务表。

### 1.1 范围与假设

- 目标基线固定为 RuoYi-Vue-Plus 5.6.2，数据库基线为 script/sql/postgres/postgres_ry_vue_5.X.sql。目标仓库在 pom.xml 中标记 revision 5.6.2。
- 当前服务保持 PostgreSQL、NestJS、Prisma 技术栈。最终五模块核心表及关系表按目标 PostgreSQL DDL 对齐；ID 继续以 BIGINT 存储，HTTP 使用十进制字符串。
- 五个模块涉及的九张表均在范围内：sys_user、sys_role、sys_menu、sys_dept、sys_post、sys_user_role、sys_role_menu、sys_role_dept、sys_user_post。
- 租户字段和租户上下文是五模块行为的一部分。迁移至少要支持 tenant_id 过滤和关联一致性；租户管理界面是否单独复刻不在本文模块范围内，但目标菜单套餐选择接口依赖租户套餐数据，需按实际启用功能接入。
- 导入、导出、选项列表、树选择、用户与角色关联操作、动态路由和数据范围均属于 1:1 功能验收范围，不限于基础 CRUD。
- 目标表结构“完全一致”按 PostgreSQL DDL 的字段、类型、空值、默认值和显式约束解释。目标脚本对九张表只声明主键/组合主键，没有当前项目普遍存在的外键及唯一约束；业务事务、唯一性检查与关联维护按目标源码实现，不自行增加并发唯一性锁。不得未经数据盘点直接删除约束或列。

### 1.2 排除范围

- 不迁移系统监控、字典、通知、客户端、工作流等其他系统模块。
- 不复制 Java、MyBatis-Plus 或 Sa-Token 技术实现；只复刻其对用户可见的业务规则和接口结果。
- 不复制目标项目的演示用户、密码、租户或默认业务数据。生产初始化数据须由当前项目单独维护。

## 2. 代码与数据基线

### 2.1 目标项目基线

目标控制器位于 RuoYi-Vue-Plus-5.X/ruoyi-modules/ruoyi-system/src/main/java/org/dromara/system/controller/system/，核心业务位于对应 service/impl/Sys*ServiceImpl.java，数据对象和校验位于 domain、domain/bo、domain/vo，SQL 位于 script/sql/postgres/postgres_ry_vue_5.X.sql。

目标服务的共同行为包括：基于当前租户过滤业务数据；按操作者角色与资源列应用数据权限；关联变更和用户写入使用事务；删除前检查系统角色、已分配关系及父子关系；通过业务校验而不是数据库外键维护多张关联表。目标缓存被角色、部门或用户变更时清理，当前项目无同等缓存层依赖。

### 2.2 当前项目基线

当前后端模块已由 apps/gateway/src/modules/system/system.module.ts 注册，并由全局 AuthGuard、PermissionGuard 保护。Prisma 已创建上述九张表，模型位于 prisma/models/。用户端权限由 user_role → role_menu → menu.permission_code 实时计算；用户服务部分接入数据范围。

现有后端的管理接口是较精简的 REST CRUD：用户列表分页，其余部门、岗位、角色、菜单列表为全量扁平列表；用户、角色、岗位、菜单、部门的接口覆盖均小于目标接口集。当前管理前端位于 frontend/apps/web-antdv-next；它包含用户、角色、菜单、部门页面，没有岗位管理页面。当前前端请求的部分路径和动词与当前 NestJS 控制器不匹配，迁移时需要以一份明确的 API 契约修复。

旧 RBAC 设计不作为新实现约束；历史文档已从当前仓库删除。后续实现以冻结的 5.6.2 源码、接口契约和九表结构清单为准。

## 3. 架构差异总览

| 维度     | RuoYi-Vue-Plus 5.6.2                                                            | 当前项目                                               | 必须迁移的差异                                                      |
| -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| 持久化   | PostgreSQL DDL；MyBatis-Plus；应用侧 ASSIGN_ID 雪花 ID                          | PostgreSQL；Prisma；BIGSERIAL 自增 ID                  | 表字段精确对齐；新 ID 改为应用生成；现有 ID 原值保留                |
| 租户     | user、role、dept、post 有 tenant_id；menu 全局；若干接口受套餐菜单约束          | 当前九表没有租户字段或租户上下文                       | 建立租户身份来源、四表 tenant_id 过滤和跨租户关联拒绝               |
| 部门树   | parent_id=0 根节点，ancestors 保存逗号分隔祖先路径                              | parent_id 可空，仅按邻接节点递归                       | 转换根值并回填 ancestors；移动部门时事务更新全部后代                |
| 岗位     | 必须属于部门；岗位名按部门唯一；已分配岗位不可停用/删除                         | 无 dept_id；岗位基础 CRUD；删除不校验分配关系          | 增加所属部门与类别/备注；补齐过滤、唯一性和占用检查                 |
| 状态     | char；0 正常、1 停用                                                            | smallint；0 禁用、1 正常                               | 迁移时反转 0/1；所有 DTO、筛选和前端显示同步变更                    |
| 删除     | user、role、dept 使用 del_flag 逻辑删除；post、menu 无 del_flag，执行受限硬删除 | 五个实体都使用 is_del 软删除                           | 按目标删除语义迁移；post/menu 不得继续隐藏软删行冒充目标行为        |
| 唯一性   | 由服务校验；目标脚本未给五个实体建立唯一索引                                    | user/role/post/menu 部分字段有数据库唯一索引           | 先去重并明确冲突，再移除目标 DDL 不存在的唯一索引；复刻目标服务校验 |
| 关系约束 | 四张关系表用组合主键；DDL 无外键                                                | 有外键、级联/限制删除及反向索引                        | 精确 DDL 时移除额外 FK/索引；业务服务负责原子替换和防孤儿校验       |
| 数据范围 | 六种，包括部门及下级或本人；Mapper 列注解控制查询、详情和写入                   | 五种；主要只在用户服务使用                             | 增加第六种；按目标列映射扩展角色、部门、岗位、用户查询及写入检查    |
| 菜单权限 | M/C/F；页面菜单也可含 perms；返回用户动态路由                                   | DIRECTORY/MENU/ACTION；只有 ACTION 允许 permissionCode | 菜单类型和权限来源映射；permission 校验须兼容目标页面权限与按钮权限 |
| 密码     | BCrypt                                                                          | 当前服务使用 scrypt                                    | 仅使用 BCrypt；已有 scrypt 账号另行受控重置，不保留双格式验证       |
| HTTP ID  | Java Long                                                                       | BIGINT 在 HTTP 中是十进制字符串                        | 持续保持字符串，不能转成 JS number                                  |

## 4. 数据库结构对照

目标列定义以目标 PostgreSQL SQL 文件为准。本节列出关键列及当前差异，具体空值、默认值、约束名称和 PostgreSQL 类型必须在阶段 0 从目标 DDL 导出结构清单，作为自动化 schema diff 输入。

| 表            | 目标字段范围                                                                                                                                                                                                         | 当前主要缺失或语义差异                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sys_user      | user_id、tenant_id、dept_id、user_name、nick_name、user_type、email、phonenumber、sex、avatar、password、status、del_flag、login_ip、login_date、create_dept、create_by、create_time、update_by、update_time、remark | 缺 tenant_id、user_type、创建/更新操作者及部门、remark；username/phone/nickname 列名和长度不同；avatar 当前为 URL 文本，目标为 BIGINT OSS ID；password 当前长度较长；status 反向编码；is_del 改为 del_flag |
| sys_dept      | dept_id、tenant_id、parent_id、ancestors、dept_name、dept_category、order_num、leader、phone、email、status、del_flag、create_dept、create_by、create_time、update_by、update_time                                   | 缺租户、祖先路径、类别、负责人、电话、邮箱、审计信息；根节点从 NULL 改为 0；name/sort/status 字段需映射；状态反向                                                                                          |
| sys_post      | post_id、tenant_id、dept_id、post_code、post_category、post_name、post_sort、status、create_dept、create_by、create_time、update_by、update_time、remark                                                             | 缺 tenant_id、必需 dept_id、类别、备注和操作者；无 is_del；post_code 唯一性改为服务规则；目标岗位名称唯一范围为 dept_id + post_name                                                                        |
| sys_role      | role_id、tenant_id、role_name、role_key、role_sort、data_scope、menu_check_strictly、dept_check_strictly、status、del_flag、创建/更新审计列、remark                                                                  | roleCode 映射 role_key；缺 tenant、排序、两种 strict 标志、审计及备注；is_system 改由保留 role_key 识别；DataScope 枚举改成目标字符 1-6                                                                    |
| sys_menu      | menu_id、menu_name、parent_id、order_num、path、component、query_param、is_frame、is_cache、menu_type、visible、status、perms、icon、创建/更新审计列、remark                                                         | 缺 path 元数据、query、frame/cache、visible、icon、remark、审计列；目标没有 tenant_id 和 del_flag；route_path 映射 path；ACTION 等类型映射 M/C/F；目录/页面 perms 需保留                                   |
| sys_user_role | user_id、role_id，组合主键                                                                                                                                                                                           | 当前列相同但附带外键/索引；目标关系操作会校验租户、角色状态及超级管理员限制                                                                                                                                |
| sys_role_menu | role_id、menu_id，组合主键                                                                                                                                                                                           | 当前列相同但附带外键/索引；目标普通删除与级联删除的清理规则不同                                                                                                                                            |
| sys_role_dept | role_id、dept_id，组合主键                                                                                                                                                                                           | 当前列相同但附带外键/索引；仅 data_scope=2 时用于自定义范围                                                                                                                                                |
| sys_user_post | user_id、post_id，组合主键                                                                                                                                                                                           | 当前列相同但附带外键/索引；目标岗位有 dept_id 和启停状态检查                                                                                                                                               |

### 4.1 必须完成的数据映射

| 当前字段/值                   | 目标字段/值                  | 转换规则与阻断条件                                                                                                |
| ----------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| sys_user.username             | sys_user.user_name           | 保留原值；先检查目标长度 30、非空和重复                                                                           |
| sys_user.nickName             | sys_user.nick_name           | 保留原值；超过 30 字符需人工裁决，不可截断                                                                        |
| sys_user.phone                | sys_user.phonenumber         | 保留非空值；目标最多 11 字符，格式和重复值先盘点                                                                  |
| sys_user.avatar URL           | sys_user.avatar BIGINT       | 通过现有 OSS 文件清单映射为附件 ID；无法匹配的 URL 输出异常清单，不能强转或置空                                   |
| status 1/0 当前正常/禁用      | status '0'/'1' 目标正常/禁用 | 仅在确认当前历史状态语义后反转；同样规则用于 user、role、dept、post、menu                                         |
| is_del                        | del_flag                     | 0/1 同义映射；只对目标有 del_flag 的 user、role、dept 保留                                                        |
| sys_dept.parent_id NULL       | parent_id 0                  | 根节点转换为 0；非根值必须命中当前部门 ID                                                                         |
| sys_dept 层级关系             | ancestors                    | 按根至父节点生成逗号分隔路径；发现环、悬空父节点或跨租户父子关系时停止迁移                                        |
| roleCode / isSystem           | role_key / reserved role key | 先建立系统角色映射表，将系统角色映射到目标保留 key；业务角色编码逐一核验长度和重复                                |
| DataScope enum                | data_scope char              | ALL=1、CUSTOM=2、DEPT=3、DEPT_AND_CHILDREN=4、SELF=5；新增 6 的语义为部门及下级 OR 本人，需为其配置目标业务列规则 |
| DIRECTORY/MENU/ACTION         | M/C/F                        | 映射类型；先核对每条父子关系、页面 perms 与 ACTION permissionCode，不可仅改枚举名                                 |
| 新用户/角色/菜单/部门/岗位 ID | BIGINT 显式 ID               | 当前既有 ID 全量保留；新数据使用应用侧雪花 ID，移除 BIGSERIAL 默认依赖                                            |
| 当前时区时间戳                | timestamp                    | 统一业务时区和落库规则后转换；记录备份时间和允许的精度差异                                                        |

### 4.2 迁移前数据质量检查

执行任何 DDL 前，至少导出九张表行数、ID 最大值、关联计数、软删除计数、租户候选、用户名/邮箱/手机/角色编码/岗位编码/权限码重复清单、超长文本清单、孤儿关联、部门循环及头像 URL 映射结果。对目标 varchar 限制、NOT NULL 字段、目标角色 key、必需岗位 dept_id、树父节点和新租户映射生成逐行差异报告。

任何不能确定的 tenant_id、post.dept_id、avatar OSS ID 或 role_key 映射都作为迁移阻断项。不得用静默截断、默认清空、ID 强制转换或把所有记录不经确认地并入一个租户来绕过异常。

## 5. 功能与接口差距

### 5.1 用户管理

目标接口见 SysUserController：分页列表、导出、Excel 导入、导入模板、用户信息、详情、增改删、选项查询、重置密码、状态变更、角色授权读取和保存、部门树及按部门查询用户。新增/编辑事务同时维护 user、user_role、user_post；校验账号、电话、邮箱唯一、目标部门范围、租户配额和分配的角色/岗位。删除前保护当前用户、超级管理员及数据范围。

当前项目有用户分页和基础 CRUD、哈希密码、状态与部门字段；没有导入/导出/模板、角色或岗位读取端点、批量删除、部门树、按部门查询；管理 DTO 缺 phone、sex、avatar、user_type、remark、create/update audit 字段；关联只有写入全量替换，写关系时额外硬限制 SystemAdmin，与目标角色/租户管理员边界不等价。

### 5.2 角色管理

目标接口包含分页/导出/详情/增改/状态/批量删除/选项查询、已分配与未分配用户列表、单个/批量授权和取消、数据范围配置、角色部门树。角色写入会完整替换菜单关系；范围配置会替换 sys_role_dept；禁用或删除已分配用户的角色会失败；受保护 role_key 不可创建、修改或操作。普通角色编辑会踢出该角色关联的在线用户；角色授权用户的增删也会踢出受影响用户；`dataScope` 仅明确清除自定义部门范围缓存，用户管理页的 `authRole` 和菜单 CRUD 未统一显式刷新登录权限快照。

当前只有无分页 CRUD、关系全量替换和角色菜单关系查询；无导出、用户分配视图、逐个授权/取消、状态专用接口、严格树选择和会话失效。当前 is_system 布尔与目标保留 role_key 语义不一致；当前保护系统角色的规则不能直接代替租户管理员角色保护。

### 5.3 菜单管理

目标接口包含用户动态路由、菜单列表/详情、树选择、角色菜单树、租户套餐菜单树、增改、单删和级联删除。路由生成须处理 hidden/visible、缓存、外链、iframe、组件和 query 参数。菜单名称按父节点唯一，路由名称全局唯一、路径按规则检查；外链协议校验；单删拒绝存在子菜单或角色引用，级联删除要求无子节点并事务清理角色菜单关系。角色 menu_check_strictly 影响树的 checked keys。

当前仅有 CRUD 和扁平菜单列表；类型是 DIRECTORY/MENU/ACTION，且仅 ACTION 有 permissionCode；无 getRouters、菜单树/角色树/租户套餐树、path/name uniqueness API、visible/frame/cache/iframe/query 元数据和级联删除。当前删除是软删除并因关联拒绝；目标单删是硬删保护，级联端点会清理关联。当前前端要求嵌套 children、meta 和 authCode，需要由 API 响应适配器构造目标路由模型。

### 5.4 部门管理

目标接口包含部门树列表、排除指定节点及其子孙、详情、新增、修改、删除、选项查询。部门名按同父唯一；父部门必须启用；移动节点事务更新所有后代 ancestors；启用子部门会恢复祖先状态；停用含正常子部门或已有用户的部门被拒绝；删除根、含子部门、用户或岗位的部门被拒绝，并校验调用者数据范围。

当前有扁平 CRUD、防环、活跃父节点检查和存在子部门/用户时拒删；缺祖先路径、租户字段、字段/唯一规则、排除子树/选项端点、岗位引用检查、停用约束和审计/缓存行为。当前可以把主部门清空，目标部门修改应按 BO 校验及权限范围判定。

### 5.5 岗位管理

目标接口包含分页列表、导出、详情、增改、批量删除、岗位选项和部门树。岗位必须选择部门；post_code 全局唯一；post_name 在 dept_id 内唯一；有用户分配时不可停用或删除。分页列表经过岗位数据权限注解；目标详情、导出、选项及部分写路径没有同等的岗位范围检查，具体见 5.7.8。

当前岗位只有不分页的基础 CRUD，无前端岗位管理页、部门归属、筛选/导出/选项/部门树、引用删除限制或数据范围检查。岗位名称只增加不保证目标唯一语义；岗位编码唯一索引产生的冲突目前也未统一转换为业务冲突响应。

### 5.6 权限、租户和数据范围

目标数据范围编码为：1 全部、2 自定义部门、3 本部门、4 本部门及下级、5 本人（create_by）、6 本部门及下级或本人。`PlusDataPermissionHandler` 只作用于声明 `@DataPermission` 的 Mapper 方法；读查询按当前用户角色的条件 OR 合并，更新/删除条件 AND 合并，任一角色为“全部”时不追加范围过滤。用户、角色、部门、岗位的资源列映射不同，详见 5.7；服务层另有目标对象范围校验。自定义部门为空时使用不匹配值，不代表不受限。

当前 PermissionService 只有五种 enum；其 `getDataScope(userId, permissionCode)` 以具体权限码筛选角色，而目标数据范围拦截器读取登录用户 `LoginUser.roles` 中的角色。目标 `selectRolesByUserId` 查询没有角色状态条件，菜单权限 SQL 则会过滤停用角色；这两条授权读取路径并不完全相同。当前仅用户 service 有部分范围判断，其他模块没有同等过滤；当前范围按权限码汇总部门集合，不能表达目标资源列映射、写操作 AND 语义及类型 6。迁移验收应先以 5.6.2 的实际实现固定兼容结果；若决定统一过滤停用角色，应作为安全行为变更单独记录，不能宣称严格 1:1。

### 5.7 RBAC 权限模型与接口矩阵

#### 5.7.1 鉴权层次和授权来源

目标 RBAC 按以下顺序工作，接口权限、角色限制、数据范围和租户隔离是独立检查项：

1. **登录认证**：`SecurityConfig` 的 Sa-Token 拦截器覆盖配置保护路径，检查登录态及请求 `clientid` 与 Token 中客户端 ID 一致。五个模块的 Controller 路径受此全局检查；目标版本配置的排除路径需在阶段 0 固定。
2. **接口权限码**：`@SaCheckPermission` 校验当前用户菜单权限集合。普通用户权限来自 `sys_user_role → sys_role_menu → sys_menu.perms`；目标通过启用角色的菜单关系取 `perms`，不把权限来源限制为按钮类型 F。用户 ID 为超级管理员 ID（`1`）时，登录上下文权限集合加入 `*:*:*`。
3. **角色限制**：仅在目标 Controller 明确标注 `@SaCheckRole` 的端点额外检查角色 key。菜单列表/详情要求 `superadmin` 或 `admin` 角色之一，并且仍需各自的菜单权限码；菜单增改删及级联删除同时要求 `superadmin` 角色和对应菜单权限码；套餐菜单树要求 `superadmin` 角色和 `system:menu:query`。
4. **数据范围与租户**：租户拦截器对 `sys_user`、`sys_role`、`sys_dept`、`sys_post` 增加租户条件；`sys_menu` 是全局表。超级管理员和租户管理员绕过数据范围过滤，但不会因此取消租户边界。四张关联表没有 `tenant_id`，租户拦截器不能单独保证关联目标同租户；目标服务的对象范围校验覆盖并不一致，迁移时必须把已有覆盖和缺口分别记录。

权限码从角色授权的菜单 `perms` 字段产生；目录、页面和按钮菜单都可能保存 `perms`，前端按钮显隐只是呈现，不能替代 Controller 权限检查。角色 `menu_check_strictly` 和 `dept_check_strictly` 分别决定菜单树、部门树勾选时是否将父子节点联动。关联校验与事务边界逐项遵循目标服务，不为所有关联写入增加统一的额外检查。

权限码和角色数据范围保存在登录上下文快照中。角色常规编辑与角色管理页的用户授权操作会踢出受影响用户；数据范围设置会清除自定义部门范围缓存；用户管理页直接修改用户角色及菜单 CRUD 没有统一显式失效登录快照。当前项目在每个请求实时查权限，撤权时效与目标快照/踢出机制不同。

**无显式业务权限码的目标端点**：`GET /system/menu/getRouters`、`GET /system/user/getInfo` 和 `POST /system/user/importTemplate` 未标注 `@SaCheckPermission`；它们仍受全局登录拦截，但没有额外业务权限码要求。复刻当前 NestJS 时应为这些明确端点提供“仅登录”声明；不可将所有未声明权限的路由默认放行。当前 `PermissionGuard` 对未标注 Permission 的非公开路由默认拒绝，与目标这三个端点的权限行为不同。

#### 5.7.2 用户管理接口

| 方法与路径                                                                                  | 目标权限               | 额外角色限制 / 说明                                                  |
| ------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| `GET /system/user/list`、`GET /system/user/deptTree`、`GET /system/user/list/dept/{deptId}` | `system:user:list`     | 登录认证、租户及数据范围过滤                                         |
| `POST /system/user/export`                                                                  | `system:user:export`   | 导出结果同样受租户和数据范围限制                                     |
| `POST /system/user/importData`                                                              | `system:user:import`   | multipart 文件导入                                                   |
| `POST /system/user/importTemplate`                                                          | 无显式权限码           | 仅登录                                                               |
| `GET /system/user/getInfo`                                                                  | 无显式权限码           | 返回当前登录人的用户、角色和权限信息；仅登录                         |
| `GET /system/user/`、`GET /system/user/{userId}`                                            | `system:user:query`    | 有 ID 时还校验目标用户数据范围                                       |
| `POST /system/user`                                                                         | `system:user:add`      | 创建前校验部门范围、租户额度和账号/手机/邮箱唯一                     |
| `PUT /system/user`、`PUT /system/user/changeStatus`、`PUT /system/user/authRole`            | `system:user:edit`     | 修改目标、状态及角色授权前校验用户范围；不允许越权授予超级管理员角色 |
| `DELETE /system/user/{userIds}`                                                             | `system:user:remove`   | 不允许删除当前登录用户；服务层还校验目标用户                         |
| `GET /system/user/optionselect`、`GET /system/user/authRole/{userId}`                       | `system:user:query`    | 授权读取校验目标用户范围                                             |
| `PUT /system/user/resetPwd`                                                                 | `system:user:resetPwd` | 校验目标用户可操作且在数据范围内；目标密码 BCrypt                    |

#### 5.7.3 角色管理接口

| 方法与路径                                                                                                                                            | 目标权限             | 额外角色限制 / 说明                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /system/role/list`、`GET /system/role/authUser/allocatedList`、`GET /system/role/authUser/unallocatedList`、`GET /system/role/deptTree/{roleId}` | `system:role:list`   | 角色、用户或部门结果按租户/数据范围过滤                                                                          |
| `POST /system/role/export`                                                                                                                            | `system:role:export` | 导出遵守角色数据范围                                                                                             |
| `GET /system/role/{roleId}`、`GET /system/role/optionselect`                                                                                          | `system:role:query`  | 详情和关联目标须可见                                                                                             |
| `POST /system/role`                                                                                                                                   | `system:role:add`    | 禁止使用保留管理员 role key；角色名称及 key 唯一校验                                                             |
| `PUT /system/role`、`PUT /system/role/dataScope`、`PUT /system/role/changeStatus`                                                                     | `system:role:edit`   | 检查受保护角色与角色数据范围；菜单/部门关联原子替换                                                              |
| `PUT /system/role/authUser/cancel`、`PUT /system/role/authUser/cancelAll`、`PUT /system/role/authUser/selectAll`                                      | `system:role:edit`   | 不允许修改当前登录用户角色；`selectAll` 显式检查角色数据范围；`cancel` / `cancelAll` 未显式检查角色/用户数据范围 |
| `DELETE /system/role/{roleIds}`                                                                                                                       | `system:role:remove` | 禁止操作内置管理员角色；仍有用户分配的角色不能删除                                                               |

#### 5.7.4 菜单管理接口

| 方法与路径                                                                    | 目标权限             | 额外角色限制 / 说明                                                       |
| ----------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| `GET /system/menu/getRouters`                                                 | 无显式权限码         | 仅登录；返回按当前用户角色组装的动态路由                                  |
| `GET /system/menu/list`                                                       | `system:menu:list`   | 另需 `superadmin` 或 `admin` 角色之一                                     |
| `GET /system/menu/{menuId}`                                                   | `system:menu:query`  | 另需 `superadmin` 或 `admin` 角色之一                                     |
| `GET /system/menu/treeselect`、`GET /system/menu/roleMenuTreeselect/{roleId}` | `system:menu:query`  | 不额外限制管理员角色；带 roleId 的 checkedKeys 查询未显式检查角色数据范围 |
| `GET /system/menu/tenantPackageMenuTreeselect/{packageId}`                    | `system:menu:query`  | 另需 `superadmin` 角色；需校验套餐归属及可分配菜单                        |
| `POST /system/menu`                                                           | `system:menu:add`    | 另需 `superadmin` 角色                                                    |
| `PUT /system/menu`                                                            | `system:menu:edit`   | 另需 `superadmin` 角色                                                    |
| `DELETE /system/menu/{menuId}`                                                | `system:menu:remove` | 另需 `superadmin` 角色；存在子菜单或角色引用时拒绝                        |
| `DELETE /system/menu/cascade/{menuIds}`                                       | `system:menu:remove` | 另需 `superadmin` 角色；有子菜单时拒绝，按目标服务清理角色菜单关联        |

#### 5.7.5 部门管理接口

| 方法与路径                                                        | 目标权限             | 额外角色限制 / 说明                                                |
| ----------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| `GET /system/dept/list`、`GET /system/dept/list/exclude/{deptId}` | `system:dept:list`   | 按租户、数据范围返回部门树；排除节点时同时排除子孙                 |
| `GET /system/dept/{deptId}`、`GET /system/dept/optionselect`      | `system:dept:query`  | 详情及选项结果遵守租户、数据范围                                   |
| `POST /system/dept`                                               | `system:dept:add`    | 服务校验父部门存在且启用；目标 Controller 未显式检查父部门数据范围 |
| `PUT /system/dept`                                                | `system:dept:edit`   | 变更前校验目标/父节点范围并事务重算祖先路径                        |
| `DELETE /system/dept/{deptId}`                                    | `system:dept:remove` | 校验范围；有子部门、用户或岗位引用时拒绝                           |

#### 5.7.6 岗位管理接口

| 方法与路径                                                   | 目标权限             | 额外角色限制 / 说明                                                                            |
| ------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /system/post/list`、`GET /system/post/deptTree`         | `system:post:list`   | 岗位分页使用目标岗位范围注解；部门树使用部门范围注解                                           |
| `POST /system/post/export`                                   | `system:post:export` | 目标服务的导出查询未经过岗位数据权限注解                                                       |
| `GET /system/post/{postId}`、`GET /system/post/optionselect` | `system:post:query`  | 目标服务查询未经过岗位数据权限注解；租户行过滤仍适用                                           |
| `POST /system/post`                                          | `system:post:add`    | 校验必填字段及岗位名/编码唯一；目标 service 未显式检查部门是否存在或操作者是否有该部门数据范围 |
| `PUT /system/post`                                           | `system:post:edit`   | 已分配岗位不能停用；Controller 未显式检查岗位/部门数据范围                                     |
| `DELETE /system/post/{postIds}`                              | `system:post:remove` | 被用户分配的岗位不能删除；未显式检查岗位数据范围                                               |

#### 5.7.7 数据权限资源映射与当前差异

| 资源            | 目标数据权限列                                   | 适用规则                                                                                                     |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 用户 `sys_user` | `deptName → dept_id`；`userName → create_by`     | 列表、导出、已/未分配用户、计数和 Mapper 更新有声明的数据权限注解                                            |
| 角色 `sys_role` | `deptName → create_dept`；`userName → create_by` | 角色分页、列表、计数、详情有数据权限注解                                                                     |
| 部门 `sys_dept` | `deptName → dept_id`                             | 部门列表、分页、计数有数据权限注解；父子树和服务级检查另行实现                                               |
| 岗位 `sys_post` | `deptName → dept_id`；`userName → create_by`     | Mapper 提供分页、列表、计数注解；Controller 的列表页分页查询使用该注解。导出/详情/选项和写操作覆盖见下方缺口 |
| 菜单 `sys_menu` | 无行级数据权限列                                 | 菜单是全局资源；按登录用户的角色菜单关系过滤路由，特殊管理接口另有角色门槛                                   |

当前项目需要调整的 RBAC 差异：权限码从 `create/update/delete` 等当前命名对齐到目标 `add/edit/remove` 等；权限来源必须允许目标菜单类型中任意带 `perms` 的菜单，不局限 `ACTION`；当前 `SystemAdmin` 布尔/角色判断需要映射目标的超级管理员用户 ID 和 `superadmin`、`admin` role key；增加菜单 list/detail 的管理员角色门槛及菜单写入超管门槛；补齐以上缺失端点和显式“仅登录”端点；为每个 Controller 接口增加权限拒绝测试，为数据范围增加跨用户、跨部门、跨租户读取和变更测试。

#### 5.7.8 目标源码的对象范围缺口与实施决策

逐接口复刻时，不能把权限码校验误认为对象数据范围校验。源码中可确认以下缺口：

- 岗位分页列表查询调用带 `@DataPermission` 的 Mapper；导出经 `SysPostService.selectPostList` 直接调用 `selectVoList`，详情直接 `selectVoById`，岗位选项也走未声明范围注解的查询。岗位 Controller 的新增、修改、删除没有统一执行岗位/部门数据范围校验，只有已分配岗位不能停用/删除等业务限制。
- 部门详情、修改和删除显式调用 `checkDeptDataScope`；新增只在 service 校验父部门存在且启用，没有显式检查新增父部门的操作者数据范围。移动部门时 service 会检查新父部门范围。
- 角色授权用户列表经过用户 Mapper 数据范围注解，但列表查询没有先显式检查请求中的 roleId；角色部门树的 checkedKeys 也没有先检查 roleId 范围。`cancel` / `cancelAll` 直接按请求中的 `roleId` / `userIds` 删除 `sys_user_role`，没有显式调用角色或用户范围检查。`selectAll` 检查角色范围，但没有显式检查目标用户数据范围。
- 菜单 `roleMenuTreeselect/{roleId}` 先取调用者可见菜单树，但按请求 roleId 读取 checkedKeys 时没有显式调用角色数据范围检查。
- 普通角色编辑和角色管理页的授权增删会踢出在线用户；`dataScope` 清除自定义部门缓存但不显式踢出用户；用户管理页 `authRole`、菜单新增/修改/删除没有统一清除登录权限快照。
- 关联表不带租户列；对关系表直接按请求 ID 写入/删除时，应显式验证 role、user、dept、post 的租户归属，不能依赖租户 SQL 拦截器。

本次选择严格复刻：保留以上源代码中的覆盖差异，不在岗位详情/导出/选项、角色用户授权、部门新增等路径额外增加对象范围检查，也不统一改写会话失效时机。验收分别断言目标已有检查的拒绝行为与未覆盖路径的实际结果，不宣称所有端点均受完整行级范围保护。

## 6. 推荐架构落地方式

- 保持当前 NestJS 模块拆分，将 DTO/Controller 作为 HTTP 适配层，service 负责目标校验、租户隔离、数据权限及事务；Prisma schema 与 migration 管理目标 PostgreSQL 结构。
- 为用户、角色、部门、岗位、菜单统一建立目标 DTO/VO 映射，明确输入/输出、ID 字符串、状态 char 值、时间格式和分页包络。内部可继续使用 TypeScript enum，但写库和对外字段遵循目标值。
- 直接以目标 Controller 的路由、动词、参数绑定和响应封装替换旧 HTTP 接口；不保留兼容控制器或通用 CRUD 映射层。普通响应与分页分别对齐 `R`、`TableDataInfo`。
- Controller 负责目标入参和接口级校验；Service 负责目标业务规则及事务；数据访问层负责目标查询和 Mapper 数据范围。各层的职责与调用次序按目标实现，不将源项目没有的通用前置检查加入所有写入。
- 数据范围按目标 Mapper 的资源列映射和角色范围生成：查询按角色范围 OR，更新/删除按角色范围 AND，“全部”不追加范围条件；明确复刻的业务对象仍需执行服务层范围检查。接口权限码和行级数据范围是分开的授权维度，不能把当前项目按 permissionCode 聚合的实现直接当成目标行为。
- 当前项目每请求从数据库计算权限，与目标登录上下文快照不同。直接替换为目标快照机制，并按目标角色编辑、角色授权、数据范围配置等各自的踢出或缓存清理时机执行。
- 精确 DDL 不保留额外外键、唯一约束或索引；按目标 Service 执行业务唯一性检查，不引入目标没有的 advisory lock。

## 7. 分阶段迁移与验收

### 阶段 0：冻结基线与保护现有数据

**工作**

1. 冻结 RuoYi 5.6.2 PostgreSQL DDL 及 80 个目标源码/配置文件的 SHA-256；自动提取五模块 57 条接口的动词、路径、权限与角色要求。`verify` 检测源码、结构快照、接口契约与历史迁移被修改的情况。
2. 只提取九表 `CREATE TABLE`，不复制上游演示数据。目标 SQL 和当前 Prisma 历史迁移分别在隔离库重放，再从 PostgreSQL 系统目录读取同格式结构清单，不手写 SQL 类型解析器。
3. 对现有库开启只读、可重复读事务，自动输出结构漂移与目标差异、行数、最大 ID、重复/超长/空值、树与孤儿关系、头像和租户/岗位/角色映射待办、密码类型。备份与盘点共享导出的同一 MVCC 快照。
4. 实际执行整库 `pg_dump` 和隔离库 `pg_restore`，逐表比较九表结构、行数与 SHA-256 数据指纹，并独立重放目标 DDL。阶段 1 尚未实现时，报告明确标记目标数据转换演练未执行，不把建空目标表称为完整迁移演练。
5. 异常包含记录 ID、待定责任人、处理状态与所需决策，不能自动填租户、猜岗位部门、清空头像或转换密码。备份和明细仅落在 git 忽略的本地目录，失败记录保留供检查。

**验收**

- 技术验收：源码/契约/历史迁移校验通过；现库与迁移无漂移；备份可恢复且九表数据一致；数据质量报告无未处置阻断项。
- 当前本地实测：PostgreSQL 17.11，九表全部为空；与历史迁移差异 0 条，与目标结构差异 178 条。恢复验证与目标 DDL 重放通过，详见基线说明。
- 正式切换验收另行记录版本确认、维护窗口、读写冻结策略、恢复时间目标和回滚负责人；这些信息未提供，报告不伪造签字或宣称正式验收通过。后续有数据转换脚本后，还必须在恢复库完成完整迁移演练。

**回滚**：不执行正式库写入；本阶段可直接停止。

### 阶段 1：目标数据库结构与应用生成 ID

**工作**

1. 在已确认的维护窗口停写，用新的 Prisma migration 直接对齐目标字段、类型、空值、默认值和约束；不设计多版本双读、双写或旧应用兼容。
2. 保留现有九表行及全部主键 ID；新增的租户字段先在已审核的映射表指导下回填。单租户部署只有在书面确认后才可统一映射为 000000。
3. 增加应用侧 BIGINT 雪花 ID 生成并在服务创建路径显式赋值，验证多实例 worker 配置及碰撞检测；随后移除 BIGSERIAL 默认行为。
4. 转换列名、类型、默认值、空值和删除标记；无法转换的 avatar 和超长字段必须在迁移前处置，不在最终模型保留旧字段。
5. 比对目标 DDL 后移除目标脚本没有的外键、唯一约束及额外索引。目标 Service 的事务、业务唯一性检查和关联操作必须先实现并验证。

**验收**

- schema diff 中九张表的字段、类型、空值、默认值和目标主键与目标 PostgreSQL DDL 一致；差异清单为空或每条偏差有批准记录。
- 全部既有主键 ID 不变；所有关联行仍能解析；目标唯一性校验无冲突。
- 多实例生成 ID 不重复；API 中 BIGINT 从未转换为 JS number。
- 切换前已完成快照并验证恢复；最终模型只包含目标字段，不依赖旧应用读取路径。

**回滚**：恢复已演练的整库备份，并整体回退部署版本；不在新结构上运行旧应用。

### 阶段 2：租户、审计、密码和共享权限基础

**工作**

1. 在认证上下文中加入 tenant_id 和 tenant/superadmin 身份；数据访问层按目标为 user/role/dept/post 附加租户条件，menu 保持全局。关联表和套餐查询的检查边界逐项遵循目标源码，不增加统一的关联租户校验。
2. 增加 create_dept、create_by、update_by 等操作者审计值的可信来源；不采信请求体传入的审计人。
3. 将 role.isSystem 转为受保护 role_key 映射；保护超级管理员和租户管理员保留 key，禁止普通角色操作这些角色或给用户授予超级管理员角色。
4. 直接使用 BCrypt 创建和验证密码，移除 scrypt 登录路径；已有 scrypt 账号按阶段 0 清单另行受控重置，不尝试从哈希还原密码。
5. 将权限码目录迁移到目标 system:user/role/menu/dept/post 的 list/query/add/edit/remove/import/export/resetPwd 等命名；新增端点同步到菜单种子和服务端权限测试。
6. 实现六种数据范围及 5.7.7 的资源列映射；按目标 Mapper 注解与服务检查确定具体覆盖面，并实现查询 OR、更新/删除 AND 和超级管理员/租户管理员绕过规则。

**验收**

- 目标已有租户过滤、对象范围检查和超管例外规则逐项通过测试；5.7.8 中的关系表与对象范围缺口单独记录实际结果。
- 带目标数据范围检查的路径在越界时返回拒绝；类型 5 和 6 按 create_by 与部门树联合条件工作。
- BCrypt 行为与目标一致；旧 scrypt 不可登录；无效、停用、软删除账号按目标拒绝登录。
- 受保护角色不可被重命名为保留 key，也不能被普通用户授权。

**回滚**：整体恢复切换前数据库备份与应用版本；不将 BCrypt 转回 scrypt，不添加双格式验证。

### 阶段 3：部门与岗位

**工作**

1. 部门树引入根节点 0 和 ancestors；启动前全量回填、环检测和路径校验。创建部门由父节点路径生成 ancestors；移动部门事务改写自身及全部后代路径；停用/启用按目标子节点和祖先状态规则处理。
2. 补齐部门 tenant/category/leader/phone/email/remark 等目标字段、同父名称唯一、排除子树、树列表、详情和选项端点。
3. 岗位补齐 tenant/dept/category/sort/remark；必填与对象范围检查遵循目标 BO、Controller、Service 的实际覆盖；加入列表过滤、分页、导出、选项和部门树。
4. 用户关联岗位时按目标用户服务执行检查；已分配岗位不能停用/删除；部门删除前按目标检查用户、子部门和岗位引用。

**验收**

- 部门树的祖先路径与 parent_id 对每个节点一致；移动后所有后代结果正确；循环、跨租户父节点及越权移动拒绝。
- 不能停用含正常子部门或用户的部门，不能删除含子部门、用户或岗位的部门。
- 岗位名按 dept_id 唯一、post_code 按目标规则唯一；已分配岗位的停用/删除行为与目标一致。
- 部门和岗位分页按目标范围过滤；岗位导出、详情、选项保留 5.7.8 记录的源项目覆盖差异。

**回滚**：路径校验失败时中止发布；切换后通过整库备份和整体应用版本回退，不保留旧邻接查询作为兼容路径。

### 阶段 4：菜单、树选择与动态路由

**工作**

1. 将 menuType 映射到 M/C/F，加入 path、query_param、is_frame、is_cache、visible、icon、remark 和目标审计字段；菜单是全局表，不加 tenant_id。
2. 支持 menu perms 同时存在于目录/页面和按钮；根据目标角色关系生成权限字符串，角色停用/菜单无效时排除授权。
3. 实现 getRouters、list、detail、treeselect、roleMenuTreeselect、tenantPackageMenuTreeselect、增改、单删和 cascade 删除。
4. 实现同父名称唯一、路由名称和路径冲突检查、外链协议校验、自身不能为父菜单、层级规则检查；角色的 menu_check_strictly 决定选中 key。
5. 目标菜单无 del_flag：迁移前备份软删菜单；根据是否要恢复记录，明确恢复为 active 菜单或在受控窗口清理；最终菜单删除按目标硬删除，并清理关系。

**验收**

- 管理员路由和普通用户路由各有完整 golden response；隐藏、缓存、外链、iframe、query、组件字段映射正确。
- 页面权限与按钮权限都可由目标 `perms` 授权；显式声明业务权限码的 API 在服务端拒绝无权限请求，目标三个无显式权限码的接口仅需登录。
- 单删有子节点/角色引用时拒绝；级联删除只允许无子节点并原子清理 role_menu。
- 菜单不按租户复制；套餐菜单树严格限制到对应套餐。

**回滚**：目标路由 golden tests 通过后整体切换；通过备份与整体部署版本回退，不双读旧 MenuResponse。

### 阶段 5：角色、数据范围和授权工作流

**工作**

1. 补齐 role tenant/name/key/sort/data_scope/menu_check_strictly/dept_check_strictly/remark/审计字段；将当前枚举映射到目标 1-6。
2. 增加角色分页筛选、导出、选项、详情、状态及批量删除；按目标数据范围检查 role 访问。
3. 新增角色菜单树和部门树返回 checkedKeys + tree，遵循两个 strictly 标志；自定义范围只允许 data_scope=2，修改范围与替换 role_dept 在同事务完成。
4. 新增已分配/未分配用户分页、单用户取消、批量取消和批量授予；每个端点按 5.7.8 的源代码覆盖执行检查，不增加统一的用户/角色范围前置校验。
5. 禁止禁用或删除仍分配用户的角色；保护目标保留 key。角色编辑、角色管理页授权操作按目标踢出相关用户；数据范围配置按目标清理缓存；用户管理页授权和菜单 CRUD 保留目标失效时机。

**验收**

- 六种数据范围逐项跑用户、角色、部门、岗位资源测试；多角色查询 OR、写操作 AND、“全部”直通和超级管理员/租户管理员数据范围旁路与目标 handler 一致。另单独记录目标角色菜单权限 SQL 与数据范围角色列表状态筛选不完全一致的行为，避免误将两种授权计算合并。
- 角色菜单、部门范围、用户授权替换均有事务失败回滚测试。
- 禁止删除/停用已分配角色；用户列表分配状态和 cancel/selectAll 行为与目标一致。
- 角色编辑、菜单和授权变更后的权限快照按目标时机处理；受保护 admin 角色测试通过，不增加最后授权管理员保护。

**回滚**：通过切换前备份和整体部署版本回退，不保留旧 PermissionService 或旧权限码映射读取路径。

### 阶段 6：用户管理与关联操作

**工作**

1. 完成目标用户字段及 DTO 校验：user_name 2-30、nick_name 30、email 50、phonenumber 11、user_type、avatar OSS ID、remark、部门和租户配额。
2. 提供分页筛选、部门后代查询、用户详情/编辑初始化、按 ID 选项、部门树、按部门查询、批量删除、状态修改、密码重置和 authRole 读取/保存。
3. 新增和编辑用户主数据与 sys_user_role/sys_user_post 在事务内一起保存；关联目标先全量校验再替换，限制超级管理员角色。
4. 实现 Excel 导入模板、导入更新支持、导入结果逐行错误汇总、配置的初始密码和用户导出；导出也必须遵守租户和数据范围。
5. 密码创建、重置、修改、自助改密明确分开；目标格式 BCrypt。重置和删除不得触碰其他用户或越权对象。

**验收**

- 用户字段增改/查询、手机号邮箱唯一、租户配额、部门后代、状态、角色岗位关联与目标接口契约一致。
- 导入可以处理新建和更新、重复账号和非法引用，任何请求不会留下部分关联写入；结果中不返回明文密码。
- 导出不泄露数据范围外用户或密码/hash/内部审计字段。
- 禁止删除当前用户/超级管理员；数据范围外用户不能被详情、修改、重置、删除或授权端点访问。

**回滚**：通过备份和整体部署版本回退，不保留旧用户路由或双格式密码验证；不回写明文或弱哈希。

### 阶段 7：前端契约与完整管理流程

**工作**

1. 按目标 API 契约替换当前 frontend/apps/web-antdv-next 的路径、动词、响应 envelope、分页参数、DTO 字段和权限码。当前 UI 与 Nest 控制器不匹配的列表和更新路径直接切换到目标接口，不增加兼容路由。
2. 补岗位管理列表/筛选/增改/删除/导出、部门树过滤及用户岗位分配。
3. 完成角色菜单授权树、部门范围授权树、用户角色分配视图、已分配/未分配切换、导入/导出、状态切换、密码重置。
4. 菜单表单补目录/页面/按钮类型、路径/组件/图标、可见/外链/缓存/参数、权限标识与树选择；路由菜单响应转换为 Vben menu record。
5. 部门表单补类别、负责人、电话、邮箱、祖级路径驱动树操作；关联使用中的删除/停用提供明确业务反馈。

**验收**

- 五模块页面中所有按钮均由服务端权限决定，隐藏按钮不替代 API 鉴权。
- 用户从查询到增改、状态、角色/岗位分配、导入导出；角色从数据范围到菜单授权/用户分配；部门/岗位树和关联限制；菜单路由发布均可完整走通。
- 浏览器网络请求与目标 API 契约逐项一致；接口错误、无权限、数据冲突及空状态可正确呈现。

**回滚**：前端、API 与数据库按同一目标契约切换；整体回退备份与部署版本，不维持旧客户端兼容期。

### 阶段 8：系统回归、切换与观测

**工作**

1. 在备份恢复环境跑 Prisma migration、目标 SQL schema diff、所有自动化测试及手工管理员/普通角色/租户用户验收。
2. 按 5.7.2 至 5.7.6 的矩阵逐端点测试：无 token、clientid 不匹配、缺少权限码、菜单特殊角色不足、仅登录端点、其他租户、超范围部门、disabled/deleted 用户/角色/菜单、被引用对象和最大 BIGINT 字符串。
3. 对高风险操作验证事务边界：用户创建+角色岗位、角色+菜单、data scope+role dept、部门移动+descendants、级联菜单删除。
4. 在恢复库对比目标契约的列表计数、部门后代、菜单权限码和角色分配；通过后进入切换窗口，不新增运行时影子查询路径。
5. 发布后观察唯一性冲突、越权拒绝、树回填、导入失败、租户隔离告警、权限更新延迟及数据库慢查询；记录数据核对结果。

**总验收门槛**

- 九张目标表与 PostgreSQL DDL 的结构 diff 达到批准基线；列名、类型、nullability、默认、主键、显式索引/约束无未批准差异。
- 迁移前后 user_id、role_id、menu_id、dept_id、post_id 以及四类关系数据逐项对账，无意外丢失或串租户。
- 五模块目标功能清单全部有自动化或可重复的验收证据；每个受保护 API 有权限码测试与越权测试。
- 失败可定位到具体记录或接口；没有静默截断、无声清空或部分关系提交。
- 明确前端、API、任务脚本的整体切换与回退窗口，并在生产切换前演练数据库恢复；旧客户端必须同步更新。

## 8. 推荐执行顺序与依赖

```text
阶段 0 基线与数据盘点
  → 阶段 1 目标 Schema 与应用生成 ID
  → 阶段 2 租户 / 审计 / 密码 / 权限基础
  → 阶段 3 部门与岗位
  → 阶段 4 菜单与动态路由
  → 阶段 5 角色与授权
  → 阶段 6 用户与关系
  → 阶段 7 前端流程
  → 阶段 8 全量回归与切换
```

该顺序使部门先于岗位和数据范围，菜单先于角色授权，角色授权先于用户角色绑定。阶段 1 和 2 是结构和安全底座，在全部相关阶段完成前不得将管理 API 暴露给生产管理员。

## 9. 主要风险与处理

| 风险                         | 影响                                 | 控制措施                                                       |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| 状态编码反转错误             | 批量停用用户、角色或菜单             | 以旧数据抽样和当前 enum 语义双重确认；迁移前后分布核对         |
| tenant_id 无可靠映射         | 跨租户数据泄漏或错误合并             | 生成显式映射表；未知归属阻断迁移；单租户映射须书面批准         |
| avatar URL 无法转换为 OSS ID | 头像丢失或字段强转失败               | 按文件 URL/哈希建立映射；保留异常清单并人工修复                |
| 部门祖先路径错误             | 下级数据范围和树查询错漏             | 重算并与 parent_id 遍历结果逐节点比对；含环或孤儿时停止        |
| 目标没有 FK/唯一索引         | 孤儿数据或并发重复                   | 按目标事务与业务校验复刻；保留源项目约束边界，不增加额外锁     |
| 租户功能依赖未迁移           | 配额、套餐菜单及租户角色流程无法复刻 | 先实现租户上下文和最小依赖；菜单套餐接口无数据源时不得宣称 1:1 |
| 密码哈希算法不兼容           | 既有用户无法登录                     | 仅实现 BCrypt；已有 scrypt 账号在切换前单独安排受控重置       |
| 菜单删除从软删变硬删         | 已删除数据无法直接恢复               | 切换前导出 menu 与关联快照；级联和单删行为独立验收             |
| 唯一约束移除后校验竞态       | 同名或同编码重复                     | 记录目标业务唯一性校验的并发边界，不暗中加入目标没有的锁       |
| 接口字段及权限码差异         | 当前前端请求失败或按钮误显示         | 固定 OpenAPI/契约清单；控制器、DTO、权限种子和 UI 同批验证     |

## 10. 目标实现索引

| 范畴                     | 主要参考路径                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL schema 与种子 | RuoYi-Vue-Plus-5.X/script/sql/postgres/postgres_ry_vue_5.X.sql                                                                                                                      |
| 用户接口/服务            | ruoyi-modules/ruoyi-system/.../controller/system/SysUserController.java；service/impl/SysUserServiceImpl.java；mapper/SysUserMapper.java；resources/mapper/system/SysUserMapper.xml |
| 角色接口/服务            | ruoyi-modules/ruoyi-system/.../controller/system/SysRoleController.java；service/impl/SysRoleServiceImpl.java；mapper/SysRoleMapper.java                                            |
| 菜单接口/服务            | ruoyi-modules/ruoyi-system/.../controller/system/SysMenuController.java；service/impl/SysMenuServiceImpl.java；mapper/SysMenuMapper.java                                            |
| 部门接口/服务            | ruoyi-modules/ruoyi-system/.../controller/system/SysDeptController.java；service/impl/SysDeptServiceImpl.java；mapper/SysDeptMapper.java                                            |
| 岗位接口/服务            | ruoyi-modules/ruoyi-system/.../controller/system/SysPostController.java；service/impl/SysPostServiceImpl.java；mapper/SysPostMapper.java                                            |
| 数据范围                 | ruoyi-common/ruoyi-common-mybatis/.../enums/DataScopeType.java；handler/PlusDataPermissionHandler.java；ruoyi-modules/ruoyi-system/.../service/impl/SysDataScopeServiceImpl.java    |
| 当前后端模型与服务       | backend/prisma/models；backend/apps/gateway/src/modules/system；backend/libs/permission/src                                                                                         |
| 当前前端页面与 API       | frontend/apps/web-antdv-next/src/views/system；frontend/apps/web-antdv-next/src/api/system                                                                                          |
| 既有当前 RBAC 约定       | backend/docs/rbac-a-contract.md；backend/docs/rbac-implementation-plan.md                                                                                                           |
