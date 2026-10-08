import { setupSwagger } from '@app/swagger';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  // 让 Nest 响应 SIGTERM / SIGINT 并触发 onModuleDestroy → Prisma 断开连接、日志缓冲刷盘
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);

  // 必须在 listen() 之前：Fastify ready() 之后拒绝注册静态资源插件，
  // 而 Swagger UI 正是通过 @fastify/static 挂上去的。
  const docs = await setupSwagger(app);

  await app.listen(port, '0.0.0.0');

  console.log(await app.getUrl());
  if (docs) {
    console.log(`接口文档: ${docs.ui}   (JSON: ${docs.json})`);
  }
}

await bootstrap();
