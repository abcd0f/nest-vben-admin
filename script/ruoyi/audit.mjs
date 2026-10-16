import { quoteIdentifier, TABLES } from './schema.mjs';

const IDS = { sys_user: 'user_id', sys_role: 'role_id', sys_menu: 'menu_id', sys_dept: 'dept_id', sys_post: 'post_id' };
const RENAMES = {
  sys_user: { user_name: 'username', nick_name: 'nickname', phonenumber: 'phone' },
  sys_role: { role_key: 'role_code' },
  sys_menu: { path: 'route_path', perms: 'permission_code' },
};

export function analyzeTree(nodes) {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
  return nodes.map((node) => {
    const visited = new Set([node.id]);
    const ancestors = [];
    let parent = node.parentId;
    while (parent !== null && parent !== '0') {
      if (visited.has(parent)) return { id: node.id, error: 'cycle' };
      if (!parents.has(parent)) return { id: node.id, error: 'missing-parent', parentId: parent };
      visited.add(parent);
      ancestors.unshift(parent);
      parent = parents.get(parent);
    }
    const path = ['0', ...ancestors].join(',');
    return { id: node.id, ancestors: path, ...(path.length > 500 ? { error: 'ancestors-too-long' } : {}) };
  });
}

// The caller owns a READ ONLY repeatable-read transaction. Reports contain IDs,
// counts and decisions, never passwords, hashes, phone numbers or email values.
export async function auditData(client, schema, current, target) {
  const tables = {};
  const issues = [];
  const tableRef = (table) => `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const has = (table, column) => current[table].columns.some((row) => row.name === column);
  const record = (code, table, ids, decision) => {
    if (ids.length) issues.push({ code, table, ids, owner: null, state: 'unresolved', decision });
  };
  const find = async (table, code, condition, decision) => {
    const { rows } = await client.query(
      `SELECT ${quoteIdentifier(IDS[table])}::text AS id FROM ${tableRef(table)} WHERE ${condition} ORDER BY ${quoteIdentifier(IDS[table])}`,
    );
    record(
      code,
      table,
      rows.map((row) => row.id),
      decision,
    );
  };
  for (const table of TABLES) {
    if (!current[table].columns.length) throw new Error(`Missing current table: ${schema}.${table}`);
    const {
      rows: [summary],
    } = await client.query(
      `SELECT count(*)::text AS count${IDS[table] ? `, max(${quoteIdentifier(IDS[table])})::text AS "maxId"` : ''}${has(table, 'is_del') ? ', count(*) FILTER (WHERE is_del <> 0)::text AS "softDeleted"' : ''} FROM ${tableRef(table)}`,
    );
    tables[table] = summary;
    if (!IDS[table]) continue;
    for (const column of target[table].columns) {
      const source = RENAMES[table]?.[column.name] ?? column.name;
      if (!has(table, source)) continue;
      const length = column.type.match(/^character varying\((\d+)\)$/)?.[1];
      // Passwords are handled by hash classification below, not text truncation.
      if (length && source !== 'password') {
        await find(
          table,
          `length:${column.name}`,
          `char_length(${quoteIdentifier(source)}::text) > ${Number(length)}`,
          'Resolve overlong values explicitly; never truncate',
        );
      }
      if (!column.nullable) {
        await find(
          table,
          `null:${column.name}`,
          `${quoteIdentifier(source)} IS NULL`,
          'Provide the required target value explicitly',
        );
      }
    }
    if (has(table, 'status')) {
      tables[table].statuses = (
        await client.query(
          `SELECT status::text AS value, count(*)::text AS count FROM ${tableRef(table)} GROUP BY status ORDER BY status`,
        )
      ).rows;
      await find(
        table,
        'invalid-status',
        'status IS NULL OR status::text NOT IN (\'0\', \'1\')',
        'Confirm historical status interpretation before conversion',
      );
    }
    if (has(table, 'is_del')) {
      await find(
        table,
        'invalid-delete-flag',
        'is_del IS NULL OR is_del NOT IN (0, 1)',
        'Resolve deletion semantics before conversion',
      );
    }
    if (['sys_user', 'sys_role', 'sys_dept', 'sys_post'].includes(table) && !has(table, 'tenant_id')) {
      await find(
        table,
        'tenant-mapping-required',
        'true',
        'Assign an explicit tenant per record; no automatic default-tenant merge',
      );
    }
  }
  const uniqueRules = [
    ['sys_user', ['username']],
    ['sys_user', ['phone']],
    ['sys_user', ['email']],
    ['sys_role', ['role_code']],
    ['sys_role', ['role_name']],
    ['sys_post', ['post_code']],
    ['sys_dept', ['parent_id', 'dept_name']],
    ['sys_menu', ['parent_id', 'menu_name']],
  ];
  for (const [table, columns] of uniqueRules) {
    if (!columns.every((column) => has(table, column))) continue;
    const group = columns.map(quoteIdentifier).join(', ');
    const active = has(table, 'is_del') ? 'is_del = 0 AND ' : '';
    const present = columns
      .filter((column) => !column.endsWith('_id'))
      .map((column) => `${quoteIdentifier(column)} IS NOT NULL AND ${quoteIdentifier(column)} <> ''`)
      .join(' AND ');
    const { rows } = await client.query(
      `SELECT array_agg(${quoteIdentifier(IDS[table])}::text ORDER BY ${quoteIdentifier(IDS[table])}) AS ids FROM ${tableRef(table)} WHERE ${active}${present} GROUP BY ${group} HAVING count(*) > 1`,
    );
    for (const row of rows) {
      record(
        `duplicate:${columns.join('+')}`,
        table,
        row.ids,
        'Resolve duplicates under the target service uniqueness rule',
      );
    }
  }
  if (!has('sys_post', 'dept_id')) {
    await find(
      'sys_post',
      'post-dept-mapping-required',
      'true',
      'Assign an existing department to every post; BO requires it although DDL permits NULL',
    );
  } else {
    await find(
      'sys_post',
      'post-dept-mapping-required',
      'dept_id IS NULL',
      'Provide a department; target BO requires it',
    );
  }
  await find(
    'sys_role',
    'role-key-review-required',
    'true',
    'Review role_code to role_key, including superadmin/admin protected identities',
  );
  await find(
    'sys_user',
    'avatar-oss-mapping-required',
    'avatar IS NOT NULL AND avatar::text <> \'\'',
    'Resolve avatar URL to a verified OSS ID; never clear or cast a URL',
  );
  const { rows: passwordTypes } = await client.query(`SELECT CASE
    WHEN password ~ '^[$]2[aby][$][0-9]{2}[$][./A-Za-z0-9]{53}$' THEN 'bcrypt'
    WHEN password ~ '^scrypt[$]16384[$]8[$]1[$][0-9a-f]{32}[$][0-9a-f]{128}$' THEN 'scrypt'
    WHEN password IS NULL OR password = '' THEN 'empty'
    ELSE 'unknown' END AS type, count(*)::text AS count
    FROM ${tableRef('sys_user')} GROUP BY 1 ORDER BY 1`);
  // Repeated perms are permitted by RuoYi; inventory them without treating them as blockers.
  const { rows: duplicatePermissionCodes } = await client.query(
    `SELECT array_agg(menu_id::text ORDER BY menu_id) AS ids FROM ${tableRef('sys_menu')} WHERE permission_code IS NOT NULL AND permission_code <> '' GROUP BY permission_code HAVING count(*) > 1`,
  );
  await find(
    'sys_user',
    'password-reset-required',
    'password IS NULL OR password !~ \'^[$]2[aby][$][0-9]{2}[$][./A-Za-z0-9]{53}$\'',
    'Plan a controlled BCrypt reset; strict parity does not support scrypt login',
  );
  const relationships = [
    ['sys_user_role', 'user_id', 'sys_user'],
    ['sys_user_role', 'role_id', 'sys_role'],
    ['sys_role_menu', 'role_id', 'sys_role'],
    ['sys_role_menu', 'menu_id', 'sys_menu'],
    ['sys_role_dept', 'role_id', 'sys_role'],
    ['sys_role_dept', 'dept_id', 'sys_dept'],
    ['sys_user_post', 'user_id', 'sys_user'],
    ['sys_user_post', 'post_id', 'sys_post'],
    ['sys_user', 'dept_id', 'sys_dept'],
  ];
  for (const [table, column, parent] of relationships) {
    const keys = IDS[table] ? [IDS[table]] : current[table].columns.map((row) => row.name);
    const missing = await client.query(
      `SELECT ${keys.map((key) => `r.${quoteIdentifier(key)}::text AS ${quoteIdentifier(key)}`).join(', ')} FROM ${tableRef(table)} r LEFT JOIN ${tableRef(parent)} p ON r.${quoteIdentifier(column)} = p.${quoteIdentifier(IDS[parent])} WHERE r.${quoteIdentifier(column)} IS NOT NULL AND p.${quoteIdentifier(IDS[parent])} IS NULL`,
    );
    record(`orphan:${column}`, table, missing.rows, 'Resolve orphan associations explicitly');
  }
  const trees = {};
  for (const table of ['sys_dept', 'sys_menu']) {
    const { rows } = await client.query(
      `SELECT ${quoteIdentifier(IDS[table])}::text AS id, parent_id::text AS "parentId" FROM ${tableRef(table)} ORDER BY ${quoteIdentifier(IDS[table])}`,
    );
    trees[table] = analyzeTree(rows);
    for (const node of trees[table].filter((node) => node.error))
      record(`tree:${node.error}`, table, [node.id], 'Repair the tree before computing ancestors or converting roots');
  }
  for (const table of ['sys_menu', 'sys_post']) {
    await find(
      table,
      'soft-delete-decision-required',
      'is_del <> 0',
      'Choose restoration or separately authorized hard deletion; target has no soft-delete field',
    );
  }
  return {
    tables,
    passwordTypes,
    duplicatePermissionCodes,
    trees,
    issues,
    blockerCount: issues.length,
    readyForDataMigration: issues.length === 0,
  };
}
