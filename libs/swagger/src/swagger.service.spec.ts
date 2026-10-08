import { swaggerConfig, type SwaggerConfig } from '@app/config';
import { AppLoggerService } from '@app/logger';
import { Controller, Get, Query, type INestApplication } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ApiProperty, ApiTags, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { ApiCommonErrors } from './decorators/api-common-errors.decorator.js';
import { ApiPaginatedResponse } from './decorators/api-paginated-response.decorator.js';
import { PageQueryDto } from './dto/page-query.dto.js';
import { PaginatedDto } from './dto/paginated.dto.js';
import { AppSwaggerService } from './swagger.service.js';

/** 从 OpenAPI 文档里取用到的片段。只声明断言需要的字段，避免到处做联合类型收窄。 */
interface OperationView {
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
  parameters?: Array<{ name?: string; in?: string; required?: boolean; schema?: Record<string, unknown> }>;
}

interface SchemaView {
  properties?: Record<string, { type?: string; items?: unknown }>;
}

function operationOf(document: OpenAPIObject, path: string): OperationView {
  return (document.paths[path] as unknown as { get?: OperationView })?.get ?? {};
}

function schemaOf(document: OpenAPIObject, name: string): SchemaView {
  return (document.components?.schemas?.[name] ?? {}) as SchemaView;
}

class WidgetDto {
  @ApiProperty({ description: '主键' })
  id!: string;
}

@ApiTags('widgets')
@Controller('widgets')
class WidgetController {
  @Get()
  @ApiCommonErrors()
  @ApiPaginatedResponse(WidgetDto)
  list(@Query() query: PageQueryDto): PageQueryDto {
    return query;
  }
}

const BASE_CONFIG: SwaggerConfig = {
  enabled: true,
  path: 'docs',
  title: 'Test API',
  description: '测试用文档',
  version: '2.3.4',
  jsonUrl: 'docs/json',
  yamlUrl: 'docs/yaml',
  persistAuthorization: true,
};

function createLoggerStub() {
  return {
    setContext: vi.fn().mockReturnThis(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

async function createApp(config: Partial<SwaggerConfig> = {}) {
  const logger = createLoggerStub();
  const moduleRef = await Test.createTestingModule({
    controllers: [WidgetController],
    providers: [
      AppSwaggerService,
      { provide: swaggerConfig.KEY, useValue: { ...BASE_CONFIG, ...config } },
      { provide: AppLoggerService, useValue: logger },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  return { app, logger, service: moduleRef.get(AppSwaggerService) };
}

describe('AppSwaggerService', () => {
  it('未启用时不挂载任何路由，只记一条日志并返回 undefined', () => {
    const logger = createLoggerStub();
    const service = new AppSwaggerService({ ...BASE_CONFIG, enabled: false }, logger as unknown as AppLoggerService);
    const app = {} as INestApplication;

    expect(service.enabled).toBe(false);
    expect(service.setup(app)).toBeUndefined();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('启用时返回 UI / JSON / YAML 三个访问路径', async () => {
    const { app, service } = await createApp();

    expect(service.setup(app)).toEqual({
      ui: '/docs',
      json: '/docs/json',
      yaml: '/docs/yaml',
    });

    await app.close();
  });

  it('启用时挂载 UI、OpenAPI JSON 与 YAML', async () => {
    const { app, service } = await createApp();
    service.setup(app);
    await app.init();

    try {
      const ui = await app.inject({ method: 'GET', url: '/docs' });
      expect(ui.statusCode).toBe(200);
      expect(ui.headers['content-type']).toContain('text/html');
      expect(ui.body).toContain('Test API');

      const json = await app.inject({ method: 'GET', url: '/docs/json' });
      expect(json.statusCode).toBe(200);

      const document = json.json<OpenAPIObject>();
      expect(document.info.title).toBe('Test API');
      expect(document.info.version).toBe('2.3.4');
      expect(document.info.description).toBe('测试用文档');

      const yaml = await app.inject({ method: 'GET', url: '/docs/yaml' });
      expect(yaml.statusCode).toBe(200);
      expect(yaml.body).toContain('openapi:');
    } finally {
      await app.close();
    }
  });

  it('文档包含 bearer 安全方案（供 UI 的 Authorize 按钮使用）', async () => {
    const { app, service } = await createApp();
    service.setup(app);
    await app.init();

    try {
      const document = (await app.inject({ method: 'GET', url: '/docs/json' })).json<OpenAPIObject>();

      expect(document.components?.securitySchemes?.bearer).toMatchObject({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });
    } finally {
      await app.close();
    }
  });

  it('分页响应用具名 schema 引用实体 DTO，而不是内联展开', async () => {
    const { app, service } = await createApp();
    service.setup(app);
    await app.init();

    try {
      const document = (await app.inject({ method: 'GET', url: '/docs/json' })).json<OpenAPIObject>();
      const ok = operationOf(document, '/widgets').responses?.['200'];

      expect(ok?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/PaginatedWidgetDto',
      });

      const schema = schemaOf(document, 'PaginatedWidgetDto');
      expect(schema.properties?.list).toMatchObject({ type: 'array' });
      expect(schema.properties?.list?.items).toEqual({ $ref: '#/components/schemas/WidgetDto' });
      // 分页元信息来自 PageMetaDto，靠继承收集
      expect(Object.keys(schema.properties ?? {})).toEqual(
        expect.arrayContaining(['list', 'total', 'page', 'pageSize', 'totalPages']),
      );
    } finally {
      await app.close();
    }
  });

  it('PageQueryDto 展开为可选 query 参数，且带上限约束', async () => {
    const { app, service } = await createApp();
    service.setup(app);
    await app.init();

    try {
      const document = (await app.inject({ method: 'GET', url: '/docs/json' })).json<OpenAPIObject>();
      const parameters = operationOf(document, '/widgets').parameters ?? [];

      const page = parameters.find((item) => item.name === 'page');
      const pageSize = parameters.find((item) => item.name === 'pageSize');

      expect(page).toMatchObject({ in: 'query', required: false });
      expect(pageSize).toMatchObject({ in: 'query', required: false, schema: { maximum: 200 } });
    } finally {
      await app.close();
    }
  });

  it('通用失败响应覆盖 400/401/403/500，且响应体指向 ApiErrorDto', async () => {
    const { app, service } = await createApp();
    service.setup(app);
    await app.init();

    try {
      const document = (await app.inject({ method: 'GET', url: '/docs/json' })).json<OpenAPIObject>();
      const responses = operationOf(document, '/widgets').responses ?? {};

      for (const status of ['400', '401', '403', '500']) {
        expect(responses[status]?.content?.['application/json']?.schema).toEqual({
          $ref: '#/components/schemas/ApiErrorDto',
        });
      }
    } finally {
      await app.close();
    }
  });

  it('不配置 serverUrl 时不写 servers，让 UI 沿用当前 origin', async () => {
    const { app, service } = await createApp();
    service.setup(app);
    await app.init();

    try {
      const document = (await app.inject({ method: 'GET', url: '/docs/json' })).json<OpenAPIObject>();

      expect(document.servers ?? []).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('配置 serverUrl 时写入 servers', async () => {
    const { app, service } = await createApp({ serverUrl: 'https://api.example.com' });
    service.setup(app);
    await app.init();

    try {
      const document = (await app.inject({ method: 'GET', url: '/docs/json' })).json<OpenAPIObject>();

      expect(document.servers).toEqual([{ url: 'https://api.example.com', description: '当前环境' }]);
    } finally {
      await app.close();
    }
  });
});

describe('PaginatedDto', () => {
  it('同一模型重复调用返回同一个类（避免同名重复 schema）', () => {
    expect(PaginatedDto(WidgetDto)).toBe(PaginatedDto(WidgetDto));
  });

  it('schema 名固定为 Paginated<模型名>', () => {
    expect(PaginatedDto(WidgetDto).name).toBe('PaginatedWidgetDto');
  });
});
