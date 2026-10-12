import type { ConfigFactory, ConfigFactoryKeyHost, ConfigObject } from '@nestjs/config';

/** 配置源里的原始值。env 源只会给字符串；YAML 源可能给 string / number / boolean。 */
export type ConfigSourceValue = unknown;

/** 一个字段在配置源里的定位信息。 */
export interface FieldLocator {
  /** 所属域命名空间，如 `cors` */
  readonly namespace: string;
  /** 域内字段名，如 `maxAge` */
  readonly field: string;
  /** env 源下的变量名，如 `CORS_MAX_AGE` */
  readonly envKey: string;
}

/**
 * 配置源抽象 —— 数据「从哪来」的唯一出口。
 *
 * 换源（env → YAML / 远程配置中心）只需另写一个实现，所有域定义零改动。
 */
export interface ConfigSource {
  /** 当前环境名：development / test / production */
  readonly environment: string;
  read: (locator: FieldLocator) => ConfigSourceValue;
}

/** 各字段类型共有的声明。 */
interface CommonFieldSpec {
  /** 覆盖自动推导的 env 变量名。默认 `${envPrefix}${SCREAMING_SNAKE(field)}` */
  readonly env?: string;
}

export interface StringFieldSpec extends CommonFieldSpec {
  readonly type: 'string';
  /** 不声明 default 且未标记 optional 时为必填 */
  readonly default?: string;
  /** 声明后：缺失或空串都返回 undefined */
  readonly optional?: true;
  readonly minLength?: number;
  /** 取值前先 trim */
  readonly trim?: boolean;
}

export interface IntegerFieldSpec extends CommonFieldSpec {
  readonly type: 'integer';
  readonly default: number;
  readonly min: number;
}

export interface BooleanFieldSpec extends CommonFieldSpec {
  readonly type: 'boolean';
  readonly default: boolean;
}

export interface EnumFieldSpec<TValues extends readonly string[] = readonly string[]> extends CommonFieldSpec {
  readonly type: 'enum';
  readonly values: TValues;
  readonly default?: TValues[number];
  readonly optional?: true;
}

export interface CsvFieldSpec extends CommonFieldSpec {
  readonly type: 'csv';
  /** 逗号分隔的默认值 */
  readonly default?: string;
  /** 声明后：缺失或空白都返回 undefined */
  readonly optional?: true;
}

export type FieldSpec =
  | BooleanFieldSpec
  | CsvFieldSpec
  | EnumFieldSpec
  | IntegerFieldSpec
  | StringFieldSpec;

export type FieldSpecs = Record<string, FieldSpec>;

/** 字段声明 → 解析后的字段值类型 */
type FieldValue<TSpec extends FieldSpec> = TSpec extends { readonly type: 'string' }
  ? TSpec extends { readonly optional: true }
    ? string | undefined
    : string
  : TSpec extends { readonly type: 'integer' }
    ? number
    : TSpec extends { readonly type: 'boolean' }
      ? boolean
      : TSpec extends { readonly type: 'csv' }
        ? TSpec extends { readonly optional: true }
          ? string[] | undefined
          : string[]
        : TSpec extends { readonly type: 'enum'; readonly values: infer TValues extends readonly string[] }
          ? TSpec extends { readonly optional: true }
            ? TValues[number] | undefined
            : TValues[number]
          : never;

/** 由 fields 声明自动推导出的字段值集合 */
export type DomainValues<TSpecs extends FieldSpecs> = { [K in keyof TSpecs]: FieldValue<TSpecs[K]> };

/** 传给 resolve 的上下文 */
export interface ResolveContext {
  /** 当前环境名，供「按环境给不同默认值」这类逻辑使用 */
  readonly environment: string;
}

/** 域的声明式定义 —— 一个域的全部信息都写在这里。 */
export interface DomainDefinition<TSpecs extends FieldSpecs, TConfig extends ConfigObject> {
  /** 命名空间：既是 registerAs 的 token，也是 `configService.get('<namespace>.x')` 的前缀 */
  readonly namespace: string;
  /** env 变量名前缀。默认 `${NAMESPACE}_`；传空串表示无前缀（如 app 域直读 PORT） */
  readonly envPrefix?: string;
  /** 字段声明：一处写清键名、类型、默认值、校验范围 */
  readonly fields: TSpecs;
  /** 可选派生：把字段值组装成最终配置对象；跨字段校验也在这里抛错 */
  readonly resolve?: (values: DomainValues<TSpecs>, context: ResolveContext) => TConfig;
}

/** 域解析结果：要么给出 config，要么给出 errors。 */
export interface DomainParseResult<TConfig> {
  readonly config?: TConfig;
  readonly errors: string[];
}

/** 编译后的配置域，由 defineConfigDomain 产出。 */
export interface ConfigDomain<
  TSpecs extends FieldSpecs = FieldSpecs,
  TConfig extends ConfigObject = ConfigObject,
> extends DomainDefinition<TSpecs, TConfig> {
  /** registerAs 产物：`@Inject(xxxConfig.KEY)` 与 ConfigModule 的 load 都用它 */
  readonly token: ConfigFactory<TConfig> & ConfigFactoryKeyHost<TConfig>;
  /** 字段 → env 变量名映射，便于排查「这个值到底读的哪个变量」 */
  readonly envKeys: Readonly<Record<string, string>>;
  /** 解析该域。不抛异常，错误以列表返回，便于跨域聚合后一次性报出 */
  parse: (source: ConfigSource) => DomainParseResult<TConfig>;
}

/** 只关心「命名空间 + token + 解析」的域视图，供注册表与校验器使用。 */
export interface AnyConfigDomain {
  readonly namespace: string;
  readonly token: ConfigFactory & { readonly KEY: string | symbol };
  parse: (source: ConfigSource) => DomainParseResult<unknown>;
}
