import type { ConfigSource, Environment } from '../types.js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { ENVIRONMENTS } from '../types.js';
import { createYamlSource } from './yaml-source.js';

/** 配置文件所在目录，相对 process.cwd()（Docker 里由 WORKDIR 控制，不用 import.meta.url） */
const CONFIG_DIR = 'config';

/** 基线层文件名，必须有 */
const BASE_FILE = 'default.yaml';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 深合并：两边都是普通对象则递归合并，数组与标量整体替换 */
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return merged;
}

/** 读一层 YAML；文件不存在返回 undefined，空文件返回 {} */
function readYamlFile(file: string): Record<string, unknown> | undefined {
  if (!existsSync(file)) return undefined;

  const parsed = parseYaml(readFileSync(file, 'utf8'));
  if (parsed === undefined || parsed === null) return {};
  if (!isPlainObject(parsed)) throw new Error(`配置文件 ${file} 的顶层必须是「键: 值」映射`);
  return parsed;
}

/**
 * 环境名取自 `NODE_ENV`（由 package.json 的启动脚本用 cross-env 注入）。
 *
 * 这是全仓库唯一读取环境变量的地方；配置项本身一律走 YAML。
 */
export function resolveEnvironment(): Environment {
  const name = process.env.NODE_ENV ?? 'development';

  if (!(ENVIRONMENTS as readonly string[]).includes(name)) {
    throw new Error(`NODE_ENV 必须是 ${ENVIRONMENTS.join(' / ')} 之一，当前为 "${name}"`);
  }
  return name as Environment;
}

/**
 * 按 `default.yaml` → `<env>.yaml` → `<env>.local.yaml` 顺序加载并深合并。
 *
 * 后两层缺失不算错误；只有基线层缺失才报错（说明工作目录不对或配置没挂载）。
 */
export function loadConfigSource(): ConfigSource {
  const environment = resolveEnvironment();
  const dir = resolve(process.cwd(), CONFIG_DIR);
  const baseFile = resolve(dir, BASE_FILE);

  if (!existsSync(baseFile)) {
    throw new Error(`缺少配置基线层 ${baseFile}（当前工作目录：${process.cwd()}）`);
  }

  const layers = [baseFile, resolve(dir, `${environment}.yaml`), resolve(dir, `${environment}.local.yaml`)];

  let merged: Record<string, unknown> = {};
  for (const file of layers) {
    const layer = readYamlFile(file);
    if (layer !== undefined) merged = deepMerge(merged, layer);
  }

  return createYamlSource(merged, environment);
}

let cached: ConfigSource | undefined;

/** 全进程共享同一份配置源：启动校验与各域 registerAs 工厂读的是同一份快照 */
export function configSource(): ConfigSource {
  cached ??= loadConfigSource();
  return cached;
}

/** 丢弃缓存，下次调用重新读盘（测试用） */
export function resetConfigSource(): void {
  cached = undefined;
}
