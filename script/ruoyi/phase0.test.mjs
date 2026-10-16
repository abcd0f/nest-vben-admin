import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyzeTree, auditData } from './audit.mjs';
import { extractEndpoints, sha256, verifySource } from './baseline.mjs';
import { databaseConfig, readOnlySnapshot, replaySchemas, runPgTool, withSandbox } from './database.mjs';
import { diffSchemas, extractTargetDdl, fingerprintTables, readSchema, TABLES } from './schema.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = join(root, 'docs/ruoyi/phase0');
const load = async (name) => JSON.parse(await readFile(join(baseline, name), 'utf8'));

test('frozen artifacts are intact and include only the nine target tables', async () => {
  const manifest = await load('manifest.json');
  for (const [name, hash] of Object.entries(manifest.artifacts))
    assert.equal(sha256(await readFile(join(baseline, name))), hash, name);
  const ddl = await readFile(join(baseline, 'target.sql'), 'utf8');
  assert.equal(extractTargetDdl(`${ddl}\nINSERT INTO sys_user VALUES (1);\nCREATE TABLE sys_other (id int8);`), ddl);
  assert.throws(() => extractTargetDdl('CREATE TABLE sys_user (user_id int8);'), /Missing target DDL/);
  const schema = await load('target.schema.json');
  assert.equal(schema.sys_post.columns.find((column) => column.name === 'dept_id').nullable, true);
  assert.equal(schema.sys_user.columns.find((column) => column.name === 'user_id').nullable, false);
  for (const table of TABLES) {
    assert.equal(schema[table].constraints.length, 1);
    assert.equal(schema[table].constraints[0].type, 'p');
    assert.equal(schema[table].indexes.length, 1);
  }
});

test('frozen HTTP contract retains exact method, login-only endpoints and menu role restrictions', async () => {
  const { endpoints, authentication } = await load('http-contract.json');
  assert.equal(endpoints.length, 57);
  assert.equal(new Set(endpoints.map((route) => `${route.verb} ${route.path}`)).size, 57);
  assert.deepEqual(
    endpoints
      .filter((route) => route.permission === null)
      .map((route) => `${route.verb} ${route.path}`)
      .sort(),
    ['GET /system/menu/getRouters', 'GET /system/user/getInfo', 'POST /system/user/importTemplate'],
  );
  const list = endpoints.find((route) => route.path === '/system/menu/list');
  assert.deepEqual(list.roles, ['superadmin', 'admin']);
  assert.equal(list.roleMode, 'OR');
  for (const route of endpoints.filter(
    (route) => route.path === '/system/menu' && ['POST', 'PUT'].includes(route.verb),
  ))
    assert.deepEqual(route.roles, ['superadmin']);
  assert(authentication.excludes.includes('/resource/sse'));
  assert(!authentication.excludes.some((path) => path.startsWith('/system/')));
});

test('endpoint extraction handles optional paths, multipart attributes and annotation boundaries', () => {
  const routes = extractEndpoints(
    `@RequestMapping("/system/user")
public class SysUserController {
 @SaCheckPermission("system:user:query")
 @GetMapping(value = {"/", "/{userId}"})
 public R<Info> getInfo(Long userId) {
 }
 @PostMapping(value = "/importData", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
 public R<Void> importData(File file) {
 }
}`,
    'fixture.java',
  );
  assert.deepEqual(
    routes.map((route) => [route.verb, route.path, route.permission]),
    [
      ['GET', '/system/user/', 'system:user:query'],
      ['GET', '/system/user/{userId}', 'system:user:query'],
      ['POST', '/system/user/importData', null],
    ],
  );
});

test('schema diff detects nullability, defaults, FK and index changes', async () => {
  const target = await load('target.schema.json');
  const current = structuredClone(target);
  current.sys_post.columns.find((column) => column.name === 'dept_id').nullable = false;
  current.sys_user.columns.find((column) => column.name === 'user_id').default =
    'nextval(\'sys_user_user_id_seq\'::regclass)';
  current.sys_user.constraints.push({
    name: 'extra_fk',
    type: 'f',
    definition: 'FOREIGN KEY (dept_id) REFERENCES sys_dept(dept_id)',
  });
  current.sys_user.indexes.push({
    name: 'extra_unique',
    definition: 'CREATE UNIQUE INDEX extra_unique ON sys_user (user_name)',
  });
  const differences = diffSchemas(current, target);
  assert.deepEqual(differences.map((row) => row.name).sort(), ['dept_id', 'extra_fk', 'extra_unique', 'user_id']);
  assert.deepEqual(diffSchemas(target, target), []);
});

test('tree audit preserves maximum BIGINT and detects cycles, missing parents and path overflow', () => {
  assert.deepEqual(
    analyzeTree([
      { id: '9223372036854775807', parentId: null },
      { id: '2', parentId: '9223372036854775807' },
    ]),
    [
      { id: '9223372036854775807', ancestors: '0' },
      { id: '2', ancestors: '0,9223372036854775807' },
    ],
  );
  assert.equal(
    analyzeTree([
      { id: '1', parentId: '2' },
      { id: '2', parentId: '1' },
    ])[0].error,
    'cycle',
  );
  assert.equal(analyzeTree([{ id: '1', parentId: '3' }])[0].error, 'missing-parent');
  const nodes = Array.from({ length: 30 }, (_, index) => ({
    id: (9223372036854775807n - BigInt(index)).toString(),
    parentId: index === 0 ? '0' : (9223372036854775808n - BigInt(index)).toString(),
  }));
  assert.equal(analyzeTree(nodes).at(-1).error, 'ancestors-too-long');
});

test('source drift and missing source files fail verification', async () => {
  const temporary = join(root, '.local/ruoyi-phase0', `source-test-${Date.now()}`);
  await mkdir(temporary, { recursive: true });
  await writeFile(join(temporary, 'source.java'), 'baseline');
  const manifest = { sourceFiles: [{ path: 'source.java', sha256: sha256('baseline') }] };
  await verifySource(manifest, temporary);
  await writeFile(join(temporary, 'source.java'), 'changed');
  await assert.rejects(verifySource(manifest, temporary), /Frozen upstream source changed/);
  await assert.rejects(verifySource(manifest, join(temporary, 'missing')), /Frozen upstream source changed/);
});

test(
  'PostgreSQL rehearsal audits nonempty data and restores exact BIGINT rows',
  { skip: !process.env.RUOYI_DATABASE_URL, timeout: 120_000 },
  async () => {
    const config = databaseConfig(process.env.RUOYI_DATABASE_URL);
    const target = await load('target.schema.json');
    await withSandbox(config, async (client, name) => {
      const replayed = await replaySchemas(client, root, await readFile(join(baseline, 'target.sql'), 'utf8'));
      assert.deepEqual(diffSchemas(replayed.target, target), []);
      assert.deepEqual(diffSchemas(replayed.current, await load('current.schema.json')), []);
      await client.query('SET search_path TO stage0_current');
      await client.query(`
      INSERT INTO sys_dept (dept_id, dept_name, updated_time) VALUES (9223372036854775807, 'root', now());
      UPDATE sys_dept SET parent_id = dept_id;
      INSERT INTO sys_role (role_id, role_code, role_name, updated_time) VALUES (1, 'one', 'duplicate', now()), (2, 'two', 'duplicate', now());
      INSERT INTO sys_post (post_id, post_code, post_name, updated_time, is_del) VALUES (1, 'post', 'post', now(), 1);
      ALTER TABLE sys_user_post DROP CONSTRAINT sys_user_post_post_id_fkey;
    `);
      const password = `scrypt$16384$8$1$${'a'.repeat(32)}$${'b'.repeat(128)}`;
      await client.query(
        'INSERT INTO sys_user (user_id, dept_id, username, nickname, phone, email, password, avatar, updated_time) VALUES (9223372036854775807, 9223372036854775807, $1, NULL, $2, $3, $4, $5, now())',
        [
          'u'.repeat(35),
          '12345678901234',
          `${'e'.repeat(51)}@example.org`,
          password,
          'https://example.org/private-avatar',
        ],
      );
      await client.query(
        'INSERT INTO sys_user_role VALUES (9223372036854775807, 1); INSERT INTO sys_user_post VALUES (9223372036854775807, 999)',
      );
      const snapshot = await readOnlySnapshot(client);
      const structure = await readSchema(client, 'stage0_current');
      const audit = await auditData(client, 'stage0_current', structure, target);
      const codes = audit.issues.map((issue) => issue.code);
      for (const code of [
        'length:user_name',
        'null:nick_name',
        'length:phonenumber',
        'length:email',
        'tenant-mapping-required',
        'post-dept-mapping-required',
        'role-key-review-required',
        'avatar-oss-mapping-required',
        'password-reset-required',
        'duplicate:role_name',
        'tree:cycle',
        'orphan:post_id',
        'soft-delete-decision-required',
      ])
        assert(codes.includes(code), code);
      assert.equal(audit.tables.sys_user.maxId, '9223372036854775807');
      assert.deepEqual(audit.passwordTypes, [{ type: 'scrypt', count: '1' }]);
      assert.equal(audit.readyForDataMigration, false);
      assert(audit.issues.every((issue) => issue.owner === null && issue.state === 'unresolved'));
      const serialized = JSON.stringify(audit);
      for (const secret of [password, '12345678901234', 'https://example.org/private-avatar', '@example.org'])
        assert(!serialized.includes(secret));
      const fingerprints = await fingerprintTables(client, 'stage0_current');
      assert.equal(fingerprints.sys_user.count, '1');
      const sourceUrl = new URL(config.connectionString);
      sourceUrl.pathname = `/${name}`;
      const sandboxConfig = { ...config, connectionString: sourceUrl.toString() };
      const output = join(root, '.local/ruoyi-phase0', `restore-test-${Date.now()}`);
      await mkdir(output, { recursive: true });
      const file = join(output, 'fixture.dump');
      await runPgTool('pg_dump', sandboxConfig, { snapshot, file, container: process.env.RUOYI_PG_CONTAINER });
      await withSandbox(config, async (restored, database) => {
        await runPgTool('pg_restore', sandboxConfig, { database, file, container: process.env.RUOYI_PG_CONTAINER });
        await readOnlySnapshot(restored);
        assert.deepEqual(diffSchemas(await readSchema(restored, 'stage0_current'), structure), []);
        assert.deepEqual(await fingerprintTables(restored, 'stage0_current'), fingerprints);
        await restored.query('ROLLBACK');
      });
      await client.query('ROLLBACK');
      await client.query('UPDATE stage0_current.sys_user SET username = \'changed\'');
      await readOnlySnapshot(client);
      assert.notEqual(
        (await fingerprintTables(client, 'stage0_current')).sys_user.sha256,
        fingerprints.sys_user.sha256,
      );
      await client.query('ROLLBACK');
    });
  },
);
