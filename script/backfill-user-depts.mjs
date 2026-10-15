import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { load } from 'js-yaml';

const apply = process.argv.includes('--apply');
const mapFile = process.env.LEGACY_DEPT_MAP_FILE;
if (!mapFile) throw new Error('请设置 LEGACY_DEPT_MAP_FILE 指向旧 dept_id 到新部门 ID 的 JSON 映射文件');

const environment = process.env.NODE_ENV ?? 'development';
const configDir = resolve(process.cwd(), 'config');
const base = load(readFileSync(resolve(configDir, 'default.yaml'), 'utf8'));
const envFile = resolve(configDir, `${environment}.yaml`);
let config = base;
try {
  const env = load(readFileSync(envFile, 'utf8'));
  config = { ...base, ...env, database: { ...base.database, ...env.database } };
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const connectionString = config.database?.url;
if (!connectionString) throw new Error('database.url 未配置');

const mapping = JSON.parse(readFileSync(resolve(mapFile), 'utf8'));
if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('映射文件必须是 JSON 对象');
for (const [legacyId, deptId] of Object.entries(mapping)) {
  if (!legacyId || !/^[1-9]\d*$/.test(String(deptId))) throw new Error(`无效映射: ${legacyId} -> ${deptId}`);
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  const { rows: legacyRows } = await client.query('SELECT DISTINCT legacy_dept_id FROM sys_user WHERE legacy_dept_id IS NOT NULL');
  const missing = legacyRows.map((row) => row.legacy_dept_id).filter((id) => !Object.hasOwn(mapping, id));
  if (missing.length) throw new Error(`以下旧部门 ID 未提供映射: ${missing.join(', ')}`);
  const targets = [...new Set(Object.values(mapping).map(String))];
  const { rows: deptRows } = await client.query('SELECT dept_id::text FROM sys_dept WHERE dept_id = ANY($1::bigint[])', [targets]);
  const existing = new Set(deptRows.map((row) => row.dept_id));
  const invalidTargets = targets.filter((id) => !existing.has(id));
  if (invalidTargets.length) throw new Error(`映射目标部门不存在: ${invalidTargets.join(', ')}`);

  let affected = 0;
  for (const [legacyId, deptId] of Object.entries(mapping)) {
    const result = await client.query('UPDATE sys_user SET dept_id = $1::bigint WHERE legacy_dept_id = $2 AND dept_id IS DISTINCT FROM $1::bigint', [String(deptId), legacyId]);
    affected += result.rowCount;
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(`${apply ? '已回填' : '预览'} ${affected} 个用户部门关联`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
