import { AuthModule } from '@app/auth';
import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { AppLoggerModule } from '@app/logger';
import { AppSwaggerModule } from '@app/swagger';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';

import { AppService } from './app.service.js';

@Module({
  imports: [
    // 配置是所有模块的前置依赖，放第一位。
    // 内部负责：按 NODE_ENV 加载 .env、启动时校验环境变量、注册各配置域。
    AppConfigModule.forRoot(),
    // 全局日志模块：pino 只写日志文件，控制台仍由 Nest ConsoleLogger 输出
    AppLoggerModule.forRoot(),
    // 全局模块，业务模块注入 PrismaService 时无需再 import
    DatabaseModule,
    AuthModule,
    // 接口文档。真正挂载在 main.ts 里调 setupSwagger(app) 完成
    // （Swagger 需要 INestApplication 实例，模块内拿不到）。
    AppSwaggerModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
