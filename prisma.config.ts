import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';

// 与 apps/gateway/src/app.module.ts 里 ConfigModule 的 envFilePath 保持同一套顺序：
// 越具体越优先（override=false → 先加载者生效）。
for (const path of [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, '.env.local', '.env']) {
  loadEnv({ path, override: false });
}

export default defineConfig({
  schema: 'prisma/',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma CLI（migrate / db push / studio）用这个连接串，运行时用的是驱动适配器里的连接串。
    url: env('DATABASE_URL'),
  },
});
