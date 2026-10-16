import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { quoteIdentifier, readSchema } from './schema.mjs';

export function databaseConfig(connectionString) {
  if (!connectionString) throw new Error('Set RUOYI_DATABASE_URL explicitly; the CLI never guesses a database');
  const url = new URL(connectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('PostgreSQL URL required');
  const schema = url.searchParams.get('schema') ?? 'public';
  url.searchParams.delete('schema');
  return { connectionString: url.toString(), schema };
}

export async function connect(config, database) {
  const url = new URL(config.connectionString);
  if (database) url.pathname = `/${database}`;
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.query('SET TIME ZONE \'UTC\'');
  await client.query('SET statement_timeout = \'60s\'');
  await client.query('SET lock_timeout = \'5s\'');
  return client;
}

export async function readOnlySnapshot(client) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  return (await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
}

export async function withSandbox(config, work) {
  const admin = await connect(config);
  const name = `ruoyi_stage0_${randomUUID().replaceAll('-', '')}`;
  let created = false;
  let client;
  try {
    await admin.query(`CREATE DATABASE ${quoteIdentifier(name)} TEMPLATE template0`);
    created = true;
    client = await connect(config, name);
    return await work(client, name);
  } finally {
    if (client) await client.end();
    // Only drop the random database created by this invocation, never the source.
    if (created) await admin.query(`DROP DATABASE ${quoteIdentifier(name)}`);
    await admin.end();
  }
}

export async function replaySchemas(client, backendRoot, targetDdl) {
  const migrations = [];
  for (const entry of (await readdir(join(backendRoot, 'prisma/migrations'), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    migrations.push(await readFile(join(backendRoot, 'prisma/migrations', entry.name, 'migration.sql'), 'utf8'));
  }
  for (const [schema, sql] of [
    ['stage0_current', migrations.join('\n')],
    ['stage0_target', targetDdl],
  ]) {
    await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
    await client.query(`SET search_path TO ${quoteIdentifier(schema)}`);
    await client.query(sql);
  }
  return { current: await readSchema(client, 'stage0_current'), target: await readSchema(client, 'stage0_target') };
}

export async function runPgTool(tool, config, { database, snapshot, file, container }) {
  const url = new URL(config.connectionString);
  const args = [
    '--host',
    url.hostname,
    '--port',
    url.port || '5432',
    '--username',
    decodeURIComponent(url.username),
    '--dbname',
    database ?? decodeURIComponent(url.pathname.slice(1)),
  ];
  if (tool === 'pg_dump') args.push('--format=custom', '--no-owner', '--no-privileges', `--snapshot=${snapshot}`);
  else args.push('--no-owner', '--no-privileges', '--exit-on-error');
  const command = container ? 'docker' : tool;
  const environment = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
  // Docker's --env NAME takes the value from the CLI environment, keeping it out of argv.
  const toolArgs = container ? ['exec', '-i', '--env', 'PGPASSWORD', container, tool, ...args] : args;
  const child = spawn(command, toolArgs, { env: environment, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${tool} failed (${code}): ${environment.PGPASSWORD ? stderr.replaceAll(environment.PGPASSWORD, '[redacted]') : stderr}`,
            ),
          ));
  });
  let transfer;
  if (tool === 'pg_dump') {
    child.stdin.end();
    transfer = pipeline(child.stdout, createWriteStream(file, { flags: 'wx' }));
  } else {
    child.stdout.resume();
    transfer = pipeline(createReadStream(file), child.stdin);
  }
  const results = await Promise.allSettled([finished, transfer]);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
}
