import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { load } from 'js-yaml';

const apply = process.argv.includes('--apply');
const environment = process.env.NODE_ENV ?? 'development';
const configDir = resolve(process.cwd(), 'config');
const base = load(readFileSync(resolve(configDir, 'default.yaml'), 'utf8'));
let config = base;
try {
  const env = load(readFileSync(resolve(configDir, `${environment}.yaml`), 'utf8'));
  config = { ...base, ...env, database: { ...base.database, ...env.database } };
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const connectionString = config.database?.url;
if (!connectionString) throw new Error('database.url 未配置');

const permissions = [
  ['system:user:list', '用户列表'], ['system:user:query', '用户详情'], ['system:user:create', '创建用户'],
  ['system:user:update', '更新用户'], ['system:user:delete', '删除用户'], ['system:user:reset-password', '重置用户密码'],
  ['system:user:assign-posts', '分配用户岗位'], ['system:user:assign-roles', '分配用户角色'],
  ['system:dept:list', '部门列表'], ['system:dept:query', '部门详情'], ['system:dept:create', '创建部门'],
  ['system:dept:update', '更新部门'], ['system:dept:delete', '删除部门'],
  ['system:post:list', '岗位列表'], ['system:post:query', '岗位详情'], ['system:post:create', '创建岗位'],
  ['system:post:update', '更新岗位'], ['system:post:delete', '删除岗位'],
  ['system:role:list', '角色列表'], ['system:role:query', '角色详情'], ['system:role:create', '创建角色'],
  ['system:role:update', '更新角色'], ['system:role:delete', '删除角色'], ['system:role:assign-depts', '配置角色部门范围'],
  ['system:role:assign-menus', '配置角色菜单权限'],
  ['system:menu:list', '菜单列表'], ['system:menu:query', '菜单详情'], ['system:menu:create', '创建菜单'],
  ['system:menu:update', '更新菜单'], ['system:menu:delete', '删除菜单'],
];

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  const { rows: roles } = await client.query('SELECT role_id::text FROM sys_role WHERE is_system = true AND status = 1 AND is_del = 0');
  if (roles.length !== 1) throw new Error(`需要恰好一个有效系统角色，当前找到 ${roles.length} 个`);
  let inserted = 0;
  for (const [permissionCode, menuName] of permissions) {
    const result = await client.query(
      `INSERT INTO sys_menu (menu_type, menu_name, permission_code, status, updated_time)
       VALUES ('ACTION', $1, $2, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (permission_code) DO NOTHING
       RETURNING menu_id`,
      [menuName, permissionCode],
    );
    if (result.rowCount) {
      inserted++;
      await client.query('INSERT INTO sys_role_menu (role_id, menu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roles[0].role_id, result.rows[0].menu_id]);
    } else {
      const { rows } = await client.query('SELECT menu_id FROM sys_menu WHERE permission_code = $1 AND menu_type = \'ACTION\' AND status = 1 AND is_del = 0', [permissionCode]);
      if (rows[0]) await client.query('INSERT INTO sys_role_menu (role_id, menu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roles[0].role_id, rows[0].menu_id]);
    }
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(`${apply ? '已登记' : '预览'} ${permissions.length} 个权限码，新增 ${inserted} 个，系统角色 ${roles[0].role_id}`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
