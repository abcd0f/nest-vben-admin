import type { CorsConfig } from '@app/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { corsConfig } from '@app/config';
import { setupSwagger } from '@app/swagger';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  // 让 Nest 响应 SIGTERM / SIGINT 并触发 onModuleDestroy → Prisma 断开连接、日志缓冲刷盘
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);

  // 跨域。必须在 listen() 之前：enableCors 内部是 register(import('@fastify/cors'))，
  // 插件只有在 Fastify 实例 ready 之前注册才生效。
  const cors = app.get<CorsConfig>(corsConfig.KEY);
  if (cors.enabled) {
    app.enableCors({
      origin: cors.origin,
      methods: cors.methods,
      credentials: cors.credentials,
      maxAge: cors.maxAge,
      // allowedHeaders / exposedHeaders 必须「有值才带」：显式传 undefined 会覆盖
      // @fastify/cors 的 null 默认值 —— 前者让「反射浏览器请求头」失效，
      // 后者会写出一个值为 undefined 的 Expose-Headers。
      ...(cors.allowedHeaders ? { allowedHeaders: cors.allowedHeaders } : {}),
      ...(cors.exposedHeaders ? { exposedHeaders: cors.exposedHeaders } : {}),
    });
  }

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
