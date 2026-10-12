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
import { createEnvSource } from './source/env-source.js';

const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;

/** `maxAge` → `MAX_AGE`，`poolIdleTimeout` → `POOL_IDLE_TIMEOUT` */
export function toScreamingSnake(name: string): string {
  return name.replace(CAMEL_BOUNDARY, '$1_$2').toUpperCase();
}

/** 推导字段对应的 env 变量名：显式 `env` 优先，否则 `前缀 + SCREAMING_SNAKE(字段名)` */
function resolveEnvKey(namespace: string, field: string, spec: FieldSpec, envPrefix: string | undefined): string {
  if (spec.env !== undefined) return spec.env;
  return `${envPrefix ?? `${namespace.toUpperCase()}_`}${toScreamingSnake(field)}`;
}

/**
 * 定义一个配置域。
 *
 * 一个域只需要在这里声明三件事：命名空间、字段、以及可选的派生逻辑。
 * 校验、注册、类型推导全部由本函数产出，不再需要维护额外的清单文件。
 *
 * @example
 * ```ts
 * export const metricsDomain = defineConfigDomain({
 *   namespace: 'metrics',
 *   fields: {
 *     enabled: { type: 'boolean', default: false },
 *     path: { type: 'string', default: 'metrics', minLength: 1 },
 *   },
 *   resolve: (values) => ({ enabled: values.enabled, path: values.path.replace(/^\/+|\/+$/g, '') }),
 * });
 * export const metricsConfig = metricsDomain.token;
 * ```
 */
export function defineConfigDomain<
  const TSpecs extends FieldSpecs,
  TConfig extends ConfigObject = DomainValues<TSpecs>,
>(definition: DomainDefinition<TSpecs, TConfig>): ConfigDomain<TSpecs, TConfig> {
  const fields: FieldSpecs = definition.fields;
  const envKeys: Record<string, string> = {};

  for (const field of Object.keys(fields)) {
    envKeys[field] = resolveEnvKey(definition.namespace, field, fields[field], definition.envPrefix);
  }

  function parse(source: ConfigSource): DomainParseResult<TConfig> {
    const errors: string[] = [];
    const values: Record<string, unknown> = {};

    for (const [field, spec] of Object.entries(fields)) {
      const envKey = envKeys[field];
      try {
        values[field] = parseField(envKey, spec, source.read({ namespace: definition.namespace, field, envKey }));
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

  // registerAs 工厂在 DI 阶段执行：此时 @nestjs/config 已把 env 文件写回 process.env。
  const token = registerAs(definition.namespace, () => {
    const { config, errors } = parse(createEnvSource(process.env));
    if (errors.length > 0) {
      throw new Error(
        `配置域 ${definition.namespace} 解析失败：\n${errors.map((error) => `  - ${error}`).join('\n')}`,
      );
    }
    return config as TConfig;
  });

  return { ...definition, token, envKeys, parse };
}
