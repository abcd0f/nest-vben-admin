/**
 * Bearer 安全方案的名称。
 *
 * `DocumentBuilder.addBearerAuth()` 与 `@ApiBearerAuth()` 的默认名都是 `'bearer'`。
 * 这里提成常量，是为了让「声明方案」和「引用方案」共用同一个值——
 * 否则哪天有人在 `addBearerAuth` 里传了自定义名，接口会静默地不带 token。
 *
 * 单独放一个文件而不是塞进 swagger.service.ts：装饰器只需要这个字符串，
 * 不应该为此把 @app/config、@app/logger 一起拖进依赖图。
 */
export const SWAGGER_BEARER_AUTH = 'bearer';
