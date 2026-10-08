import { setupSwagger } from '@app/swagger';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  // 让 Nest 响应 SIGTERM / SIGINT 并触发 onModuleDestroy → Prisma 断开连接、日志缓冲刷盘
  app.enableShutdownHooks();

  // 必须在 app.listen() 之前：Fastify 在 ready() 之后拒绝再注册插件，
  // 而 Swagger UI 的静态资源正是通过 @fastify/static 注册的。
  // 开关与路径由 @app/config 的 swagger 域决定（生产环境默认不挂载）。
  const docs = setupSwagger(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);

  await app.listen(port, '0.0.0.0');
  console.log(await app.getUrl());
  if (docs) {
    console.log(`Swagger UI: ${docs.ui}  OpenAPI: ${docs.json}`);
  }
}

await bootstrap();
