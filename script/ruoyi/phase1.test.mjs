import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { databaseConfig, withSandbox } from './database.mjs';
import { diffSchemas, readSchema } from './schema.mjs';

const root = resolve(import.meta.dirname, '../..');
const historical = join(root, 'prisma/migrations/20261015084855_init/migration.sql');
const migration = join(root, 'docs/ruoyi/phase1/migration.sql');

test('phase 1 migration matches frozen PostgreSQL schema and refuses nonempty input', {
  skip: !process.env.RUOYI_DATABASE_URL,
  timeout: 120_000,
}, async () => {
  const config = databaseConfig(process.env.RUOYI_DATABASE_URL);
  const before = await readFile(historical, 'utf8');
  const change = await readFile(migration, 'utf8');
  const target = JSON.parse(await readFile(join(root, 'docs/ruoyi/phase0/target.schema.json'), 'utf8'));

  await withSandbox(config, async (client) => {
    await client.query(before);
    await client.query(change);
    assert.deepEqual(diffSchemas(await readSchema(client, 'public'), target), []);
    for (const table of ['sys_user', 'sys_role', 'sys_menu', 'sys_dept', 'sys_post']) {
      const id = { sys_user: 'user_id', sys_role: 'role_id', sys_menu: 'menu_id', sys_dept: 'dept_id', sys_post: 'post_id' }[table];
      const { rows } = await client.query(`SELECT column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, id]);
      assert.equal(rows[0].column_default, null);
    }
  });

  await withSandbox(config, async (client) => {
    await client.query(before);
    await client.query("INSERT INTO sys_role (role_id, role_code, role_name, updated_time) VALUES (9007199254740993, 'test', 'test', now())");
    await assert.rejects(client.query(change), /requires an empty audited nine-table dataset/);
    await client.query('ROLLBACK');
    const { rows } = await client.query('SELECT role_id::text AS id FROM sys_role');
    assert.deepEqual(rows, [{ id: '9007199254740993' }]);
  });
});
