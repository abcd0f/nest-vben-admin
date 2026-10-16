import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { auditData } from './audit.mjs';
import { collectBaseline, sha256, verifySource } from './baseline.mjs';
import { connect, databaseConfig, readOnlySnapshot, replaySchemas, runPgTool, withSandbox } from './database.mjs';
import { diffSchemas, fingerprintTables, readSchema } from './schema.mjs';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { values, positionals } = parseArgs({
  options: {
    source: { type: 'string', default: resolve(backendRoot, '../RuoYi-Vue-Plus-5.X') },
    baseline: { type: 'string', default: join(backendRoot, 'docs/ruoyi/phase0') },
    output: {
      type: 'string',
      default: join(backendRoot, '.local/ruoyi-phase0', new Date().toISOString().replaceAll(/[:.]/g, '-')),
    },
    'pg-container': { type: 'string' },
  },
  allowPositionals: true,
});
const command = positionals[0];
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const load = async (name) => JSON.parse(await readFile(join(values.baseline, name), 'utf8'));
const save = async (directory, name, value) => writeFile(join(directory, name), json(value));

async function freeze() {
  const collected = await collectBaseline(values.source, backendRoot);
  const config = databaseConfig(process.env.RUOYI_DATABASE_URL);
  const schemas = await withSandbox(config, (client) => replaySchemas(client, backendRoot, collected.ddl, { frozen: false }));
  // Refuse to replace a frozen baseline. A new approved version needs a new directory.
  await mkdir(values.baseline, { recursive: true });
  const artifacts = {
    'target.sql': collected.ddl,
    'target.schema.json': json(schemas.target),
    'current.schema.json': json(schemas.current),
    'schema-diff.json': json(diffSchemas(schemas.current, schemas.target)),
    'http-contract.json': json(collected.contract),
  };
  const manifest = {
    ...collected.manifest,
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, content]) => [name, sha256(content)])),
  };
  await writeFile(join(values.baseline, 'manifest.json'), json(manifest), { flag: 'wx' });
  for (const [name, content] of Object.entries(artifacts))
    await writeFile(join(values.baseline, name), content, { flag: 'wx' });
  console.log(
    `Frozen ${manifest.sourceFiles.length} source files, ${collected.contract.endpoints.length} routes, 9 PostgreSQL tables`,
  );
}

async function verify() {
  const manifest = await load('manifest.json');
  await verifySource(manifest, values.source);
  for (const [name, digest] of Object.entries(manifest.artifacts)) {
    if (sha256(await readFile(join(values.baseline, name))) !== digest)
      throw new Error(`Frozen artifact changed: ${name}`);
  }
  // Old migrations must be immutable. Additional migrations in later stages are allowed.
  for (const entry of manifest.currentFiles.filter((entry) => entry.path.endsWith('.sql'))) {
    if (sha256(await readFile(join(backendRoot, entry.path))) !== entry.sha256)
      throw new Error(`Historical migration changed: ${entry.path}`);
  }
  console.log('Frozen source, artifacts and historical migrations verified');
}

async function inspect(rehearse) {
  await verify();
  const config = databaseConfig(process.env.RUOYI_DATABASE_URL);
  const source = await connect(config);
  const report = {
    observedAt: new Date().toISOString(),
    scope: 'stage-0-only',
    restore: { verified: false },
    targetDataMigration: 'not-implemented-stage-1',
    release: {
      maintenanceWindow: null,
      writeFreeze: null,
      recoveryTimeObjective: null,
      rollbackOwner: null,
      approved: false,
    },
  };
  await mkdir(values.output, { recursive: true });
  try {
    const snapshot = await readOnlySnapshot(source);
    report.database = (
      await source.query(
        'SELECT current_database() AS name, current_setting(\'server_version\') AS version, current_setting(\'TimeZone\') AS timezone, current_setting(\'transaction_read_only\') AS "readOnly"',
      )
    ).rows[0];
    const current = await readSchema(source, config.schema);
    const target = await load('target.schema.json');
    const migration = await load('current.schema.json');
    report.migrationDrift = diffSchemas(current, migration);
    report.targetDiff = diffSchemas(current, target);
    report.audit = await auditData(source, config.schema, current, target);
    report.fingerprints = await fingerprintTables(source, config.schema);
    if (rehearse) {
      const file = join(values.output, 'database.dump');
      const startedAt = Date.now();
      await runPgTool('pg_dump', config, { snapshot, file, container: values['pg-container'] });
      report.backup = { file: 'database.dump', sha256: sha256(await readFile(file)), snapshotConsistent: true };
      await withSandbox(config, async (sandbox, name) => {
        await runPgTool('pg_restore', config, { database: name, file, container: values['pg-container'] });
        await readOnlySnapshot(sandbox);
        const restoredSchema = await readSchema(sandbox, config.schema);
        const restoredFingerprints = await fingerprintTables(sandbox, config.schema);
        await sandbox.query('ROLLBACK');
        const schemaDiff = diffSchemas(restoredSchema, current);
        const dataEqual = JSON.stringify(restoredFingerprints) === JSON.stringify(report.fingerprints);
        if (schemaDiff.length || !dataEqual)
          throw new Error('Backup restore verification failed: schema or data differs');
        const replayed = await replaySchemas(
          sandbox,
          backendRoot,
          await readFile(join(values.baseline, 'target.sql'), 'utf8'),
          { baseline: values.baseline },
        );
        if (diffSchemas(replayed.target, target).length)
          throw new Error('Target DDL replay differs from frozen baseline');
        report.restore = {
          verified: true,
          schemaEqual: true,
          dataEqual,
          targetDdlReplayed: true,
          durationMs: Date.now() - startedAt,
        };
      });
    }
    report.technicalBaselinePassed =
      report.migrationDrift.length === 0 && report.audit.blockerCount === 0 && report.restore.verified;
    report.phase0Accepted = false; // Operational ownership and cutover sign-off are human decisions.
    await save(values.output, 'report.json', report);
    console.log(
      json({
        report: join(values.output, 'report.json'),
        tables: report.audit.tables,
        schemaDifferences: report.targetDiff.length,
        migrationDrift: report.migrationDrift.length,
        dataBlockers: report.audit.blockerCount,
        restore: report.restore,
        technicalBaselinePassed: report.technicalBaselinePassed,
        phase0Accepted: report.phase0Accepted,
      }),
    );
    if (report.migrationDrift.length || report.audit.blockerCount) process.exitCode = 1;
  } catch (error) {
    report.failure = {
      code: error.code ?? null,
      message: error.message.replaceAll(config.connectionString, '[redacted]'),
    };
    await save(values.output, 'report.json', report);
    throw error;
  } finally {
    await source.query('ROLLBACK').catch(() => {});
    await source.end();
  }
}

try {
  if (command === 'freeze') {
    await freeze();
  } else if (command === 'verify') {
    await verify();
  } else if (command === 'inspect') {
    await inspect(false);
  } else if (command === 'rehearse') {
    await inspect(true);
  } else {
    throw new Error(
      'Usage: node script/ruoyi/phase0.mjs freeze|verify|inspect|rehearse [--source PATH] [--baseline PATH] [--output PATH] [--pg-container NAME]',
    );
  }
} catch (error) {
  console.error(error.code ? `Phase 0 failed: ${error.code} (${error.message})` : error.message);
  process.exitCode = 1;
}
