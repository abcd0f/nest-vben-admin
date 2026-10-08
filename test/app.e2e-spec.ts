import { setupSwagger } from '@app/swagger';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../apps/gateway/src/app.module.js';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    // 与 main.ts 的调用顺序保持一致：必须在 init()/listen() 之前挂载文档
    setupSwagger(app);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('/docs/json 返回真实 AppModule 的 OpenAPI 文档', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);

    const document = response.json<OpenAPIObject>();

    expect(document.info.title).toBe('Nest Vben Admin API');
    // 业务接口与它的分页出参都进了文档
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining(['/', '/list']));
    expect(document.components?.schemas).toHaveProperty('PaginatedUserDto');
    expect(document.components?.schemas).toHaveProperty('UserDto');
    // 出参 DTO 不得把密码带进文档
    expect(JSON.stringify(document.components?.schemas?.UserDto)).not.toContain('password');
  });

  it('/docs 返回 Swagger UI 页面', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });

  afterEach(async () => {
    await app.close();
  });
});
