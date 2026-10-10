import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { appConfig } from './app.config.js';
import { corsConfig } from './cors.config.js';
import { databaseConfig } from './database.config.js';
import { validateEnv } from './env.validation.js';
import { loggerConfig } from './logger.config.js';
import { redisConfig } from './redis.config.js';
import { swaggerConfig } from './swagger.config.js';

/**
 * 全局配置模块 —— 应用配置的唯一入口。
 *
 * 职责：
 * - 按 NODE_ENV 加载对应的 .env 文件
 * - 启动时校验全部环境变量（fail-fast，配置写错直接崩）
 * - 把各配置域注册成可注入的命名空间
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
 * 新增配置域时，在对应的 *.config.ts 中实现解析与注册，并在本文件注册 provider。
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
          validate: validateEnv,
          load: [appConfig, corsConfig, databaseConfig, loggerConfig, redisConfig, swaggerConfig],
        }),
      ],
      exports: [NestConfigModule],
    };
  }
}
