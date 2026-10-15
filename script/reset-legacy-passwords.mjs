import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { hashPassword, isPasswordHash } from '../libs/auth/src/password.ts';

const apply = process.argv.slice(2).join(' ') === '--apply';
if (process.argv.length > 2 && !apply) {
  throw new Error('仅支持 --apply；不传参数时只统计');
}

const connectionString = process.env.RESET_DATABASE_URL;
if (!connectionString) {
  throw new Error('请通过 RESET_DATABASE_URL 显式指定目标数据库');
}

const url = new URL(connectionString);
const schema = url.searchParams.get('schema') ?? 'public';
url.searchParams.delete('schema');

const client = new Client({ connectionString: url.toString() });
await client.connect();

try {
  await client.query('SELECT set_config(\'search_path\', quote_ident($1), false)', [schema]);
  if (apply) await client.query('BEGIN');
  const result = await client.query(`SELECT user_id, password FROM sys_user${apply ? ' FOR UPDATE' : ''}`);
  const legacy = result.rows.filter((row) => !isPasswordHash(row.password));

  if (apply) {
    for (const row of legacy) {
      const unusablePassword = randomBytes(32).toString('hex');
      await client.query('UPDATE sys_user SET password = $1 WHERE user_id = $2', [
        await hashPassword(unusablePassword),
        row.user_id,
      ]);
    }
    await client.query('COMMIT');
  }

  console.log(`待重置账号：${legacy.length}；已重置：${apply ? legacy.length : 0}`);
} catch (error) {
  if (apply) await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
