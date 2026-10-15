import { Client } from 'pg';
import { hashPassword } from '../libs/auth/src/password.ts';

const [userId] = process.argv.slice(2);
if (process.argv.length !== 3 || !/^[1-9]\d*$/.test(userId) || BigInt(userId) > 9223372036854775807n) {
  throw new Error('用法：node --experimental-strip-types script/set-user-password.mjs <userId>');
}

const password = process.env.RESET_NEW_PASSWORD;
const connectionString = process.env.RESET_DATABASE_URL;
if (!password || password.length < 6 || password.length > 64 || !connectionString) {
  throw new Error('必须设置 RESET_DATABASE_URL 和 6～64 位的 RESET_NEW_PASSWORD');
}

const url = new URL(connectionString);
const schema = url.searchParams.get('schema') ?? 'public';
url.searchParams.delete('schema');

const client = new Client({ connectionString: url.toString() });
await client.connect();

try {
  await client.query('SELECT set_config(\'search_path\', quote_ident($1), false)', [schema]);
  const result = await client.query(
    'UPDATE sys_user SET password = $1 WHERE user_id = $2 AND is_del = 0 RETURNING user_id',
    [await hashPassword(password), userId],
  );
  if (result.rowCount !== 1) throw new Error('用户不存在或已删除');
  console.log(`已重置用户 ${userId} 的密码`);
} finally {
  await client.end();
}
