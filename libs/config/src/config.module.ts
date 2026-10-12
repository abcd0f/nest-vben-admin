import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { configSource, resetConfigSource } from './core/source/index.js';
import { validateConfigSource } from './core/validate.js';
import { DOMAINS } from './domains/index.js';

/**
 * 全局配置模块 —— 应用配置的唯一入口。
 *
 * 职责只有三件（不含任何域的具体知识）：
 * - 按 `NODE_ENV` 选择并深合并 `config/default.yaml` → `<env>.yaml` → `<env>.local.yaml`
 * - 启动时校验全部配置域（同步 fail-fast，配置写错在模块装配阶段就崩）
 * - 把注册表里的域注册成可注入的命名空间
 *
 * 用法：
 *   imports: [AppConfigModule.forRoot(), ...]   // 放在 AppModule imports 的第一位
 *
 * 业务侧读取配置，两种等价方式：
 *   // 1. 注入命名空间（推荐，类型最准）
 *   constructor(@Inject(databaseConfig.KEY) private readonly db: DatabaseConfig) {}
 *   // 2. 走 ConfigService 的路径访问
 *   configService.get<string>('database.url')
 *
 * 新增配置域：见 domains/index.ts 的说明。本文件无需改动。
 */
@Global()
@Module({})
export class AppConfigModule {
  static forRoot(): DynamicModule {
    // 同步校验：这里是模块装配阶段，早于 listen()，配错会立刻崩而不是带病启动。
    const source = configSource();
    try {
      validateConfigSource(DOMAINS, source);
    } catch (error) {
      // 校验失败就别留着这份快照，否则同一进程内重试会一直拿到坏配置。
      resetConfigSource();
      throw error;
    }

    return {
      module: AppConfigModule,
      global: true,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          // 配置全部来自 config/*.yaml：不读 .env，也不回落到 process.env
          ignoreEnvFile: true,
          skipProcessEnv: true,
          // 注册清单由注册表派生，不再手工维护
          load: DOMAINS.map((domain) => domain.token),
        }),
      ],
      exports: [NestConfigModule],
    };
  }
}
