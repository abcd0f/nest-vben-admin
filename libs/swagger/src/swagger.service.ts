import type { SwaggerConfig } from '@app/config';
import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject, SwaggerCustomOptions } from '@nestjs/swagger';
import { swaggerConfig } from '@app/config';
import { AppLoggerService } from '@app/logger';
import { Inject, Injectable } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * 注释驱动文档所需的插件元数据工厂。
 *
 * 形状与 `script/generate-swagger-metadata.mjs` 生成的 `metadata.ts` 默认导出一致——
 * 是一个**函数**而不是对象：`SwaggerModule.loadPluginMetadata()` 内部会调用它。
 */
export type SwaggerMetadataFactory = () => Promise<Record<string, unknown>>;

/** 文档挂载后的访问路径（带前导斜杠），供启动日志打印 */
export interface SwaggerDocsPaths {
  ui: string;
  json: string;
  yaml: string;
}

/**
 * Swagger 文档服务。
 *
 * 职责：把「配置 + 编译期从注释收集到的元数据」编译成 OpenAPI 文档并挂载 UI。
 *
 * 关于元数据从哪来：本项目**不使用任何 `@Api*` 装饰器**。接口描述全部来自
 * DTO / Controller 上的 JSDoc，由 `script/generate-swagger-metadata.mjs`
 * 在构建前扫描 AST 生成 `apps/<app>/src/metadata.ts`，运行时经
 * `SwaggerModule.loadPluginMetadata()` 挂回各个类。
 *
 * 为什么挂载不能由模块自己完成：`SwaggerModule.createDocument()` 需要一个
 * **已创建的 INestApplication 实例**，provider 拿不到它。所以最后一步必须在
 * `main.ts` 里显式调用（`setupSwagger(app, metadata)` 一行）。
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
   * 而 Swagger UI 的静态资源是通过 `@fastify/static` 注册上去的。
   */
  async setup(app: INestApplication, metadata?: SwaggerMetadataFactory): Promise<SwaggerDocsPaths | undefined> {
    if (!this.config.enabled) {
      this.logger.info('Swagger 文档未启用，跳过挂载', { path: this.config.path });
      return undefined;
    }

    // 顺序不能反：元数据是挂在 DTO / Controller 类上的，
    // createDocument() 之后才加载的话，schema 已经生成完了，等于没生效。
    if (metadata) {
      await SwaggerModule.loadPluginMetadata(metadata);
    }

    const document = SwaggerModule.createDocument(app, this.buildDocument(), {
      // 顺带扫描通过 RouterModule 动态挂载的子模块路由，避免接口漏收录
      deepScanRoutes: true,
      // 没有显式分组的 controller 按类名自动成组（去掉 Controller 后缀），
      // 保证不出现「未分类」接口
      autoTagControllers: true,
    });

    SwaggerModule.setup(this.config.path, app, document, this.buildUiOptions());

    const paths: SwaggerDocsPaths = {
      ui: `/${this.config.path}`,
      json: `/${this.config.jsonPath}`,
      yaml: `/${this.config.yamlPath}`,
    };

    // 日志文件里留痕；控制台提示由 main.ts 负责（本模块只写文件，见 libs/logger）
    this.logger.info('Swagger 文档已挂载', { ...paths });

    return paths;
  }

  /**
   * 文档元信息（标题、版本、说明）。
   *
   * 这里只声明「全局通用」的东西。分组、接口描述、参数说明、响应模型
   * 全部由注释 + TS 类型推导，不在这里也不在业务代码里手写。
   */
  private buildDocument(): Omit<OpenAPIObject, 'paths'> {
    const builder = new DocumentBuilder().setTitle(this.config.title).setVersion(this.config.version);

    if (this.config.description) {
      builder.setDescription(this.config.description);
    }

    // 不写 servers：Swagger UI 会沿用当前页面的 origin，
    // 本地 / 测试 / 生产各自打开就用各自的地址，不需要按环境改配置。
    return builder.build();
  }

  /**
   * Swagger UI 行为选项。
   *
   * 这些是「开发者体验」开关而不是部署差异，所以不放环境变量——
   * 它们不改变接口契约，改了也不该影响线上行为。
   */
  private buildUiOptions(): SwaggerCustomOptions {
    return {
      customSiteTitle: this.config.title,
      // 显式给出原始文档地址，方便前端 / CI 直接拉取做 SDK 代码生成
      jsonDocumentUrl: this.config.jsonPath,
      yamlDocumentUrl: this.config.yamlPath,
      swaggerOptions: {
        // 把 Authorize 里填的凭据落进 localStorage，刷新页面不用重填
        persistAuthorization: true,
        // 默认只展开 tag 列表，接口多时首屏才不卡
        docExpansion: 'none',
        // 顶部过滤框
        filter: true,
        // 每个请求显示耗时，调接口时顺手发现慢接口
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
