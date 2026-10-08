import { AuthModule } from '@app/auth';
import { DatabaseModule, validateEnv } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';

import { AppService } from './app.service.js';

const nodeEnv = process.env.NODE_ENV ?? 'development';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // 越具体越优先（先加载者生效）：
      // .env.development.local > .env.development > .env.local > .env
      envFilePath: [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, '.env.local', '.env'],
      // 启动即校验，配置缺失/写错直接崩溃，不带病上线
      validate: validateEnv,
    }),
    // 全局模块，业务模块注入 PrismaService 时无需再 import
    DatabaseModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
