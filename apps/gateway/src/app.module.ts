import { AuthModule } from '@app/auth';
import { AppConfigModule } from '@app/config';
import { CoreModule } from '@app/core';
import { DatabaseModule } from '@app/database';
import { AppLoggerModule } from '@app/logger';
import { AppSwaggerModule } from '@app/swagger';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';


import { UserModule } from './modules/system/user/user.module.js';

@Module({
  imports: [
    // 配置是所有模块的前置依赖，放第一位。
    // 内部负责：按 NODE_ENV 加载 .env、启动时校验环境变量、注册各配置域。
    AppConfigModule.forRoot(),
    // 全局日志模块：pino 只写日志文件，控制台仍由 Nest ConsoleLogger 输出
    AppLoggerModule.forRoot(),
    // 核心横切：统一响应包装 + 全局异常过滤器 + 全局参数校验管道。
    // 依赖 AppLoggerService 记日志，故排在 AppLoggerModule 之后。
    CoreModule.forRoot(),
    // 全局模块，业务模块注入 PrismaService 时无需再 import
    DatabaseModule,
    // 接口文档（注释驱动）。挂载动作在 main.ts 的 setupSwagger()，不在模块里。
    AppSwaggerModule.forRoot(),
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
