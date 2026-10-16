# 阶段 0：RuoYi-Vue-Plus 5.6.2 冻结基线

实施日期：2026-10-16。当前范围是冻结和验证，五个业务模块的替换从阶段 1 开始。

## 实施口径

用户已要求直接替换旧实现、不兼容旧接口，以 RuoYi-Vue-Plus 5.6.2 为唯一行为基线。保留 NestJS、Prisma、PostgreSQL 技术栈；HTTP BIGINT 使用十进制字符串。旧数据只能通过离线转换进入新模型，不保留双 DTO、双路由、双密码或双读写路径。

目标源码中的对象范围覆盖和会话失效时机同样属于基线，详见主迁移文档 5.7.8。不增加统一鉴权检查、全局权限失效或并发唯一性锁。

## 可审查产物

| 文件 | 用途 |
| --- | --- |
| `manifest.json` | 固定 5.6.2、PostgreSQL、80 个目标源码/配置文件及当前 Prisma 文件的 SHA-256；记录生成产物校验值 |
| `target.sql` | 从上游 PostgreSQL SQL 原文提取的九表 DDL，无演示数据或其他表 |
| `target.schema.json` | PostgreSQL 实际执行目标 DDL 后读取的列、类型、有效空值、默认值、主键、约束、索引 |
| `current.schema.json` | 在隔离库重放当前 Prisma 历史迁移后读取的相同格式结构 |
| `schema-diff.json` | 当前迁移结构与目标结构的 178 条差异；后续阶段使用相同算法验证对齐结果 |
| `http-contract.json` | 自动提取的 57 条接口，包括动词、路径、权限、角色、源码行号及全局认证排除路径 |

九表为 `sys_user`、`sys_role`、`sys_menu`、`sys_dept`、`sys_post`、`sys_user_role`、`sys_role_menu`、`sys_role_dept`、`sys_user_post`。

必须区分数据库约束与 BO 校验：例如目标 `sys_post.dept_id` 在 DDL 中可空，BO 中必填；主键列即使没有显式 `NOT NULL`，PostgreSQL 实际仍不可空。目标九表仅含主键及对应索引，没有外键或额外唯一索引。

## 工具职责

工具位于 `script/ruoyi/`，独立于 Nest 运行时，无新增依赖。

- `baseline.mjs`：收集源码清单、提取接口契约、校验上游源码漂移。
- `schema.mjs`：提取九表 DDL、读取 PostgreSQL 系统目录、计算结构差异和数据指纹。
- `audit.mjs`：读取现有数据，报告异常与待定映射；不修改记录、不猜测映射。
- `database.mjs`：连接、只读快照、隔离库生命周期、迁移重放、备份及恢复。
- `phase0.mjs`：命令编排与验收报告；失败返回非零退出码并保留诊断报告。

盘点包含行数、最大 ID、软删除和状态分布、必填空值、超长值、业务唯一范围重复、部门/菜单树、孤儿关联、租户/岗位部门/角色 key/头像映射待办、历史密码类型。重复菜单权限码只做盘点，不作为目标唯一性要求。报告使用字符串 ID，不输出密码、哈希、电话、邮箱或头像 URL 的实际值。

## 复现命令

在 backend 根目录执行。数据库 URL 由操作者显式通过 `RUOYI_DATABASE_URL` 提供，不从应用配置自动猜测目标库。可带 Prisma 风格的 `?schema=public`，默认 schema 为 public。请通过本地环境注入实际连接串。

```powershell
# 不需要连接数据库；校验源码、生成产物和历史迁移的完整性
pnpm ruoyi:phase0 verify

# 只读盘点；报告默认位于 .local/ruoyi-phase0/<UTC 时间>/report.json
pnpm ruoyi:phase0 inspect

# 本机 PostgreSQL 位于 pg17 容器：实际备份并恢复到随机命名的隔离库
pnpm ruoyi:phase0 rehearse --pg-container pg17

# 已安装匹配服务端版本的 PostgreSQL 客户端时，不传 --pg-container
pnpm ruoyi:phase0 rehearse

# 六项离线验证；提供数据库 URL 后再执行一项真实 PostgreSQL 集成验证
# 集成验证使用容器工具时，再设置 RUOYI_PG_CONTAINER=pg17
pnpm test:ruoyi-phase0
```

`--source` 可指定目标项目目录，默认是 backend 的同级 `RuoYi-Vue-Plus-5.X`；`--baseline` 可指定基线目录；`--output` 可指定报告目录。`freeze` 用于初次生成基线，已有基线禁止覆盖；如需更换经审核的目标版本，应使用新的基线目录。

`verify` 检查被冻结的旧 migration 不被改写，允许后续阶段追加新 migration。当前 Prisma 模型的历史哈希保留作证据，后续阶段可以修改模型。盘点中的 `migrationDrift` 始终表示相对阶段 0 历史结构的偏差，阶段 1 后出现偏差是预期的；最终目标验收应使用 `targetDiff`，不能把阶段 0 的通过条件直接用于后续发布。

源库只使用 `REPEATABLE READ READ ONLY` 事务；盘点和 `pg_dump --snapshot` 共享快照。恢复及两套 DDL 重放只在本次新建的 `ruoyi_stage0_<随机 UUID>` 数据库进行，结束后清理该库。运行 `freeze`/`rehearse` 的数据库账号需有建库权限；只读盘点不需要建库权限。`--pg-container` 适用于 PostgreSQL 与工具同处该容器、连接地址和端口在容器内也可访问的本地环境；其他部署使用能连接实际服务的本机 PostgreSQL 客户端。

备份为整库 custom 格式，恢复使用 `--exit-on-error --no-owner --no-privileges`；九表逐表核对结构和数据指纹。所有权和 ACL 不在本次恢复等价验证范围内。备份、明细和测试数据只保存在 git 忽略的 `.local/ruoyi-phase0/`，不要提交真实数据库备份。

## 当前实测结果

本地数据库为 `nest-admin`，PostgreSQL 17.11。2026-10-16 的实际演练得到：

| 检查 | 结果 |
| --- | --- |
| 冻结源码 | 80 个文件，版本 5.6.2 |
| 接口契约 | 57 条；3 条仅登录接口；菜单特殊角色门槛已记录 |
| 九表数据 | 全部 0 行，最大 ID 为 NULL，软删除记录为 0 |
| 现库与 Prisma 历史迁移 | 0 条漂移 |
| 现库与目标 DDL | 178 条差异，作为后续重写输入 |
| 待处置数据异常 | 0 项；当前无用户、角色、部门、岗位、菜单或关联可供映射 |
| 整库备份与隔离恢复 | 已执行；九表结构、行数及 SHA-256 指纹一致 |
| 目标 DDL 重放 | 已执行，结构与冻结清单一致 |
| 自动化验证 | 原有 141 项通过、1 项跳过；新增 7 项全部通过（包含实际 PostgreSQL 集成验证）；Nest 构建通过 |

运行报告包含 `technicalBaselinePassed`，而 `phase0Accepted` 保持 false。正式切换的维护窗口、读写冻结策略、恢复时间目标、回滚负责人和版本签字尚未提供；工具不会代替责任人批准。目标数据转换脚本属于阶段 1，目前明确记录为 `not-implemented-stage-1`，本次恢复验证不等于完整目标数据迁移演练。

回滚方式：阶段 0 没有改写源库业务数据，可直接停止；源库备份保存在本地。后续整体切换的回滚必须使用已演练的备份与相应部署版本，不能依赖新模型上的旧兼容路径。
