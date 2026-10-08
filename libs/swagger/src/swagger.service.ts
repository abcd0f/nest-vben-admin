import { swaggerConfig, type SwaggerConfig } from '@app/config';
import { AppLoggerService } from '@app/logger';
import { Inject, Injectable, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject, type SwaggerCustomOptions } from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH } from './swagger.constants.js';

/** 文档挂载后的访问路径（带前导斜杠），供启动日志打印 */
export interface SwaggerDocsPaths {
  ui: string;
  json: string;
  yaml: string;
}

/**
 * Swagger 文档服务。
 *
 * 职责：把「配置 + 装饰器收集到的元数据」编译成 OpenAPI 文档，并挂载 UI。
 *
 * 为什么不在模块内部自动完成：`SwaggerModule.createDocument()` 需要一个
 * **已创建的 INestApplication 实例**，而模块（provider）拿不到它。所以最后一步
 * 必须在 `main.ts` 里显式调用——用 `setupSwagger(app)` 一行搞定（见 swagger.setup.ts）。
 */
@Injectable()
export class AppSwaggerService {
  constructor(
    @Inject(swaggerConfig.KEY) private readonly config: SwaggerConfig,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(AppSwaggerService.name);
  }

  /** 当前配置下文档是否会被挂载 */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 挂载接口文档；未启用时返回 `undefined`。
   *
   * **必须在 `app.listen()` 之前调用**：Fastify 在 `ready()` 之后拒绝再注册插件，
   * 而 Swagger UI 的静态资源正是通过 `@fastify/static` 注册上去的。
   */
  setup(app: INestApplication): SwaggerDocsPaths | undefined {
    if (!this.config.enabled) {
      this.logger.info('Swagger 文档未启用，跳过挂载', { path: this.config.path });
      return undefined;
    }

    const document = SwaggerModule.createDocument(app, this.buildDocument(), {
      // 顺带扫描通过 RouterModule 动态挂载的子模块路由，避免接口漏收录
      deepScanRoutes: true,
      // 没有 @ApiTags 的 controller 自动按类名分组（去掉 Controller 后缀），
      // 保证不会出现「未分类」接口
      autoTagControllers: true,
    });

    SwaggerModule.setup(this.config.path, app, document, this.buildUiOptions());

    const paths: SwaggerDocsPaths = {
      ui: `/${this.config.path}`,
      json: `/${this.config.jsonUrl}`,
      yaml: `/${this.config.yamlUrl}`,
    };

    // 日志文件里留痕；控制台提示由 main.ts 负责（本模块只写文件，见 libs/logger）
    this.logger.info('Swagger 文档已挂载', { ...paths });

    return paths;
  }

  /**
   * 构建文档元信息（标题、版本、安全方案……）。
   *
   * 这里只声明「全局通用」的东西；具体的接口描述由 controller 上的
   * `@ApiTags` / `@ApiOperation` / `@ApiPaginatedResponse` 等装饰器提供。
   */
  private buildDocument(): Omit<OpenAPIObject, 'paths'> {
    const builder = new DocumentBuilder().setTitle(this.config.title).setVersion(this.config.version).addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '填 access token 即可，Swagger UI 会自动补上 "Bearer " 前缀',
      },
      SWAGGER_BEARER_AUTH,
    );

    if (this.config.description) {
      builder.setDescription(this.config.description);
    }

    // 不配 serverUrl 时不写 servers：Swagger UI 会沿用当前页面的 origin，
    // 本地、测试、生产各自打开就用各自的地址，不用改配置。
    if (this.config.serverUrl) {
      builder.addServer(this.config.serverUrl, '当前环境');
    }

    return builder.build();
  }

  /**
   * Swagger UI 行为选项。
   *
   * 这些是「开发者体验」开关，不是部署差异，所以不放进环境变量——
   * 唯一例外是 `persistAuthorization`（把 token 落进 localStorage，有安全含义）。
   */
  private buildUiOptions(): SwaggerCustomOptions {
    return {
      customSiteTitle: this.config.title,
      // 显式给出原始文档地址，方便前端/CI 直接拉取做 SDK 代码生成
      jsonDocumentUrl: this.config.jsonUrl,
      yamlDocumentUrl: this.config.yamlUrl,
      swaggerOptions: {
        persistAuthorization: this.config.persistAuthorization,
        // 默认只展开 tag 列表，接口多时首屏才不卡
        docExpansion: 'none',
        // 顶部过滤框
        filter: true,
        // 每个请求显示耗时，调接口时能顺手发现慢接口
        displayRequestDuration: true,
        // 打开页面即可直接 Try it out，少点一次
        tryItOutEnabled: true,
        showRequestHeaders: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    };
  }
}
