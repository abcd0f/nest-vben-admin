import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { appConfig } from './domains/app.config.js';
import { databaseConfig } from './domains/database.config.js';
import { loggerConfig } from './domains/logger.config.js';
import { swaggerConfig } from './domains/swagger.config.js';
import { validateEnv } from './env/env.validation.js';

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
 * 新增一个配置域只需三步：
 *   1. domains/ 下新建 xxx.config.ts，导出 xxxEnvSchema + registerAs('xxx', ...)
 *   2. env/env.schema.ts 里把 xxxEnvSchema.shape spread 进去
 *   3. 本文件 `load` 数组里加上 xxxConfig
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
          load: [appConfig, databaseConfig, loggerConfig, swaggerConfig],
        }),
      ],
      exports: [NestConfigModule],
    };
  }
}
