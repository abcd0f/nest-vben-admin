import type { ConfigObject } from '@nestjs/config';
import type {
  ConfigDomain,
  ConfigSource,
  DomainDefinition,
  DomainParseResult,
  DomainValues,
  FieldSpec,
  FieldSpecs,
} from './types.js';
import { registerAs } from '@nestjs/config';
import { parseField } from './fields.js';
import { configSource } from './source/index.js';

const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;

/** `maxAge` → `max-age`；`poolIdleTimeout` → `pool-idle-timeout` */
export function toKebabCase(name: string): string {
  return name.replace(CAMEL_BOUNDARY, '$1-$2').toLowerCase();
}

/** 推导字段的键路径：`(namespace, 'poolIdleTimeout', { key: 'pool.idleTimeout' })` → `['database', 'pool', 'idle-timeout']` */
function resolveKeyPath(namespace: string, field: string, spec: FieldSpec): string[] {
  return [namespace, ...(spec.key ?? field).split('.').map(toKebabCase)];
}

/**
 * 定义一个配置域。
 *
 * 一个域只需要声明三件事：命名空间、字段、以及可选的派生逻辑。
 * 键路径推导、校验、注册、类型推导全部由本函数产出，不再需要维护额外的清单文件。
 *
 * @example
 * ```ts
 * export const metricsDomain = defineConfigDomain({
 *   namespace: 'metrics',
 *   fields: {
 *     enabled: { type: 'boolean', default: false },
 *     path: { type: 'string', default: 'metrics', minLength: 1 },
 *     buckets: { type: 'list', default: ['p50', 'p90', 'p99'] },
 *   },
 * });
 * export const metricsConfig = metricsDomain.token;
 * ```
 * 对应 `config/default.yaml`：
 * ```yaml
 * metrics:
 *   enabled: false
 *   path: metrics
 *   buckets: [p50, p90, p99]
 * ```
 */
export function defineConfigDomain<
  const TSpecs extends FieldSpecs,
  TConfig extends ConfigObject = DomainValues<TSpecs>,
>(definition: DomainDefinition<TSpecs, TConfig>): ConfigDomain<TSpecs, TConfig> {
  const fields: FieldSpecs = definition.fields;
  const keys: Record<string, string> = {};
  const paths: Record<string, string[]> = {};

  for (const field of Object.keys(fields)) {
    const path = resolveKeyPath(definition.namespace, field, fields[field]);
    paths[field] = path;
    keys[field] = path.join('.');
  }

  function parseUncached(source: ConfigSource): DomainParseResult<TConfig> {
    const errors: string[] = [];
    const values: Record<string, unknown> = {};

    for (const [field, spec] of Object.entries(fields)) {
      try {
        values[field] = parseField(keys[field], spec, source.read({ namespace: definition.namespace, field, path: paths[field] }));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    // 字段级错误优先报出：值都不合法时再跑 resolve 只会得到误导性的二次报错。
    if (errors.length > 0) return { errors };

    try {
      const config = definition.resolve
        ? definition.resolve(values as unknown as DomainValues<TSpecs>, { environment: source.environment })
        : (values as unknown as TConfig);
      return { config, errors };
    } catch (error) {
      return { errors: [error instanceof Error ? error.message : String(error)] };
    }
  }

  // 同一个配置源只解析一次：启动校验与 registerAs 工厂共享结果，不做重复解析。
  let memoSource: ConfigSource | undefined;
  let memoResult: DomainParseResult<TConfig> | undefined;

  function parse(source: ConfigSource): DomainParseResult<TConfig> {
    if (source === memoSource && memoResult !== undefined) return memoResult;

    const result = parseUncached(source);
    memoSource = source;
    memoResult = result;
    return result;
  }

  const token = registerAs(definition.namespace, () => {
    const { config, errors } = parse(configSource());
    if (errors.length > 0) {
      throw new Error(
        `配置域 ${definition.namespace} 解析失败：\n${errors.map((error) => `  - ${error}`).join('\n')}`,
      );
    }
    return config as TConfig;
  });

  return { ...definition, token, keys, parse };
}
