# 配置模块架构重构设计

## 1. 目标与边界

`libs/config` 的目标是提供一套容易新增、容易排错、能承载多个基础设施模块的应用配置系统。

本次重构允许破坏旧版本 API。仓库内所有调用方会在同一变更中迁移，因此不保留旧版 `core/fields`、字段规格 DSL 或旧域对象的兼容层。

成功标准：

- 新增一个配置域只需新增域文件、实现解析函数、加入注册表。
- 一个域的原始键、默认值、类型检查和跨字段校验可以在同一个文件中读懂。
- YAML 加载、域解析、Nest 注册三层职责互不泄漏。
- 所有配置错误在应用启动阶段一次性报告。
- 配置域仍然可以被基础设施库独立注入，不依赖一个巨大的总配置对象。

## 2. 总体架构

```text
config/*.yaml
      |
      v
ConfigLoader  -- 分层读取、深合并、环境解析
      |
      v
RawConfigSnapshot { environment, values }
      |
      v
ConfigRegistry  -- 按域 parse + validate，聚合错误
      |
      v
Nest ConfigModule  -- registerAs(namespace, factory)
      |
      v
Typed domain injection / ConfigService path access
```

### 2.1 配置加载层

`core/config-loader.ts` 只负责：

- 解析 `NODE_ENV`。
- 按 `default.yaml`、`<env>.yaml`、`<env>.local.yaml` 顺序读取。
- 对普通对象做递归合并，数组和标量整体覆盖。
- 返回不可变的 `RawConfigSnapshot`。

它不认识 `database`、`redis`、`cors` 等业务域，也不做字段类型转换。

读取结果在进程内缓存为一个快照。测试通过显式的 `resetConfig()` 清理缓存；生产代码不支持运行时热更新，避免配置源和 Nest 容器中的配置不一致。

### 2.2 配置域层

每个域文件导出一个独立的域定义：

```ts
export interface ConfigDomain<T> {
  readonly namespace: string;
  readonly token: ConfigFactory<T> & ConfigFactoryKeyHost<T>;
  readonly parse: (raw: unknown, context: ConfigContext) => T;
  readonly validate?: (value: T, context: ConfigContext) => void;
}

export interface ConfigContext {
  readonly environment: Environment;
}
```

域定义不再声明 `FieldSpec`。域直接从自己的原始对象读取键，并调用少量显式的基础解析器。解析器都接收配置路径，确保错误能定位到 YAML 中的实际键：

```ts
export const redisDomain = defineConfigDomain({
  namespace: 'redis',
  parse(raw) {
    const value = asObject(raw, 'redis');
    return {
      enabled: asBoolean(value.enabled, false),
      url: asOptionalString(value.url),
      keyPrefix: asString(value['key-prefix'], 'cache'),
    } satisfies RedisConfig;
  },
  validate(value) {
    if (value.enabled && !value.url) {
      throw new Error('redis.url 是启用 Redis 时的必填项');
    }
  },
});
```

约束：

- 默认值、键名映射和规范化逻辑与域的最终类型放在同一文件。
- `parse` 只负责原始值到领域对象的转换。
- `validate` 只负责跨字段或业务约束；字段类型错误由基础解析器直接报出。
- 域之间禁止互相读取原始配置。需要环境信息时只使用 `ConfigContext.environment`。

基础解析器只处理原始类型、默认值和简单范围；它们失败时直接抛出带配置路径的错误。注册表负责把不同域的错误聚合起来，域的 `validate` 不承担类型转换。

### 2.3 注册与快照编译

`defineConfigDomain` 只做两件事：创建 `registerAs` 工厂令牌，并把域定义交给注册表使用。它不再维护字段键路径、字段级 memo 或额外的类型推导系统。

`ConfigRegistry` 在 `AppConfigModule.forRoot()` 中执行：

1. 读取一个 `RawConfigSnapshot`。
2. 按注册表顺序执行每个域的 `parse`。
3. 对成功解析的对象执行 `validate`。
4. 收集所有错误后一次性抛出。
5. 将已解析结果缓存到当前快照对应的 compiled map。
6. 配置域的 Nest factory 从 compiled map 取值，确保启动校验和运行时注入使用同一份对象。

校验失败时清理快照和 compiled map，再抛出错误；不会把坏配置留在进程级缓存中。

## 3. 公共 API

`libs/config/src/index.ts` 只导出以下内容：

- `AppConfigModule`。
- `defineConfigDomain`、`configSource`、`resetConfig` 等少量基础 API。
- `DOMAINS` 注册表。
- 每个域的 token 和领域类型，例如 `databaseConfig` 与 `DatabaseConfig`。

移除以下公共概念：

- `FieldSpec`、`FieldSpecs`、`DomainValues`。
- `parseField` 和自动 camelCase 到 kebab-case 的键推导。
- 让调用方依赖 `ConfigDomain.keys` 的诊断接口。

域的 Nest 注入方式仍采用类型化令牌：

```ts
constructor(@Inject(databaseConfig.KEY) private readonly config: DatabaseConfig) {}
```

`ConfigService` 的路径访问继续由 Nest 提供，例如 `database.url`，但业务库优先注入自己的域对象。

## 4. 目录调整

```text
libs/config/src/
  config.module.ts
  index.ts
  core/
    config-domain.ts       # ConfigDomain、defineConfigDomain、域注册辅助函数
    config-loader.ts       # YAML 分层加载和环境解析
    config-parsers.ts      # string/boolean/integer/list/object 基础解析器
    config-registry.ts     # parse、validate、compiled snapshot
    types.ts               # RawConfigSnapshot、ConfigContext 等最小类型
  domains/
    app.domain.ts
    cors.domain.ts
    database.domain.ts
    logger.domain.ts
    redis.domain.ts
    swagger.domain.ts
    index.ts
```

删除 `core/fields.ts`、`core/define-domain.ts` 中基于字段规格的实现；对应职责迁移到新的显式域解析器和基础解析器。

## 5. 迁移策略

这是一次仓库内原子迁移，不提供跨版本兼容：

1. 先实现新的 loader、parser、domain、registry 核心。
2. 将六个现有域改写为新的 `parse/validate` 形式，保持 YAML 键和最终配置语义不变。
3. 更新 `domains/index.ts` 与 `config.module.ts`。
4. 搜索并迁移所有调用方的导入和注入写法；删除旧类型和旧导出。
5. 删除旧核心文件，避免两套配置机制并存。
6. 更新配置模块测试和必要的库测试。

不在本次范围内：配置中心、运行时热更新、环境变量覆盖 YAML、配置加密服务、自动扫描域文件。这些功能会增加部署和调试复杂度，当前没有需求支撑。

## 6. 错误处理

错误必须包含完整路径和原因，例如：

```text
配置校验失败：
  - database.url: 必须是非空字符串
  - redis.url: redis.enabled 为 true 时必须配置
  - cors.origin: 不能把 * 与其他来源混用
```

错误分为三类：

- 文件层错误：基线文件缺失、YAML 顶层不是对象、环境名非法。
- 字段层错误：类型不符、缺少必填值、数值范围错误。
- 域规则错误：跨字段矛盾或环境相关约束。

三类错误都在模块装配阶段抛出，应用不会进入监听状态。

## 7. 测试与验收

新增 `libs/config/src/**/*.spec.ts`，覆盖：

- 分层 YAML 深合并和本地覆盖层。
- 环境解析及非法环境错误。
- 基础解析器的类型、默认值、可选值和范围校验。
- 每个域的 parse/validate 关键规则。
- 多个域错误聚合及错误路径。
- 编译快照只解析一次，Nest factory 与启动校验结果一致。
- `AppConfigModule.forRoot()` 成功装配和错误时缓存清理。

最终验收命令：

```text
pnpm test
pnpm build
```

并通过一次启动检查确认 `apps/gateway` 能读取 app、database、logger、redis、cors、swagger 六个域。
