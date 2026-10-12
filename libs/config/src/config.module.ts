import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { createEnvSource } from './core/source/env-source.js';
import { validateConfigSource } from './core/validate.js';
import { DOMAINS } from './domains/index.js';

/**
 * 全局配置模块 —— 应用配置的唯一入口。
 *
 * 职责只有三件（不含任何域的具体知识）：
 * - 按 NODE_ENV 加载对应的 .env 文件
 * - 启动时校验全部配置域（fail-fast，配置写错直接崩）
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
    const nodeEnv = process.env.NODE_ENV ?? 'development';

    return {
      module: AppConfigModule,
      global: true,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          // 越具体越优先（@nestjs/config 中数组靠前的文件覆盖靠后的）
          envFilePath: [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, '.env.local', '.env'],
          // 校验放在 validate 钩子里：它拿到的是「env 文件 + process.env」合并后的快照，
          // 是唯一能同时看到两边的时机 —— load 里的 registerAs 工厂要等 DI 阶段才执行。
          validate: (raw: Record<string, unknown>) => {
            validateConfigSource(DOMAINS, createEnvSource(raw));
            return raw;
          },
          // 注册清单由注册表派生，不再手工维护
          load: DOMAINS.map((domain) => domain.token),
        }),
      ],
      exports: [NestConfigModule],
    };
  }
}
