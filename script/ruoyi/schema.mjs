import { createHash } from 'node:crypto';

export const TABLES = [
  'sys_dept',
  'sys_menu',
  'sys_post',
  'sys_role',
  'sys_role_dept',
  'sys_role_menu',
  'sys_user',
  'sys_user_post',
  'sys_user_role',
];

export function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function extractTargetDdl(sql) {
  const statements = new Map();
  for (const match of sql.matchAll(/create table(?: if not exists)? (sys_\w+)\s*\([\s\S]*?\);/gi)) {
    if (TABLES.includes(match[1])) {
      if (statements.has(match[1])) throw new Error(`Duplicate target table: ${match[1]}`);
      statements.set(match[1], match[0]);
    }
  }
  for (const table of TABLES) {
    if (!statements.has(table)) throw new Error(`Missing target DDL: ${table}`);
  }
  // Do not execute the upstream demo INSERTs or any unrelated system tables.
  return `${TABLES.map((table) => statements.get(table)).join('\n\n')}\n`;
}

export async function readSchema(client, schema) {
  const { rows: columns } = await client.query(
    `
    SELECT c.relname AS "table", a.attname AS name, a.attnum AS position,
           format_type(a.atttypid, a.atttypmod) AS type,
           NOT a.attnotnull AS nullable, pg_get_expr(d.adbin, d.adrelid) AS "default",
           a.attidentity AS identity, a.attgenerated AS generated
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE n.nspname = $1 AND c.relname = ANY($2) AND c.relkind IN ('r', 'p')
    ORDER BY c.relname, a.attnum`,
    [schema, TABLES],
  );
  const { rows: constraints } = await client.query(
    `
    SELECT c.relname AS "table", con.conname AS name, con.contype AS type,
           pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relname = ANY($2)
    ORDER BY c.relname, con.conname`,
    [schema, TABLES],
  );
  const { rows: indexes } = await client.query(
    `
    SELECT tablename AS "table", indexname AS name, indexdef AS definition
    FROM pg_indexes WHERE schemaname = $1 AND tablename = ANY($2)
    ORDER BY tablename, indexname`,
    [schema, TABLES],
  );
  const normalize = (value) =>
    typeof value === 'string'
      ? value.replaceAll(`${quoteIdentifier(schema)}.`, '').replaceAll(`${schema}.`, '')
      : value;
  return Object.fromEntries(
    TABLES.map((table) => [
      table,
      {
        columns: columns
          .filter((row) => row.table === table)
          .map(({ table: _table, ...row }) =>
            Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalize(value)])),
          ),
        constraints: constraints
          .filter((row) => row.table === table)
          .map(({ table: _table, ...row }) => ({ ...row, definition: normalize(row.definition) })),
        indexes: indexes
          .filter((row) => row.table === table)
          .map(({ table: _table, ...row }) => ({ ...row, definition: normalize(row.definition) })),
      },
    ]),
  );
}

export function diffSchemas(current, target) {
  const differences = [];
  for (const table of TABLES) {
    for (const part of ['columns', 'constraints', 'indexes']) {
      const before = new Map((current[table]?.[part] ?? []).map((row) => [row.name, row]));
      const after = new Map((target[table]?.[part] ?? []).map((row) => [row.name, row]));
      for (const name of [...new Set([...before.keys(), ...after.keys()])].sort()) {
        if (JSON.stringify(before.get(name)) !== JSON.stringify(after.get(name))) {
          differences.push({ table, part, name, current: before.get(name) ?? null, target: after.get(name) ?? null });
        }
      }
    }
  }
  return differences;
}

// Call within a repeatable-read transaction; PostgreSQL JSON text preserves BIGINT exactly.
export async function fingerprintTables(client, schema) {
  const fingerprints = {};
  const structure = await readSchema(client, schema);
  for (const table of TABLES) {
    const primary = structure[table].constraints.find((row) => row.type === 'p');
    if (!primary) throw new Error(`Missing table or primary key: ${schema}.${table}`);
    const columns = primary.definition.match(/^PRIMARY KEY \(([^)]+)\)/)?.[1];
    if (!columns) throw new Error(`Unsupported primary key: ${table}`);
    const hash = createHash('sha256');
    let count = 0n;
    await client.query(
      `DECLARE stage0_rows NO SCROLL CURSOR FOR SELECT to_jsonb(t)::text AS row FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} t ORDER BY ${columns}`,
    );
    try {
      while (true) {
        const { rows } = await client.query('FETCH 1000 FROM stage0_rows');
        if (rows.length === 0) break;
        for (const row of rows) {
          hash.update(`${row.row}\n`);
          count++;
        }
      }
    } finally {
      await client.query('CLOSE stage0_rows');
    }
    fingerprints[table] = { count: count.toString(), sha256: hash.digest('hex') };
  }
  return fingerprints;
}
