/**
 * 本目录暂为空，是**有意为之**。
 *
 * 原因见 `libs/logger/src/logger.interceptor.ts` 的注释：本项目跑在 Fastify 上，
 * Nest 中间件依赖 `@fastify/middie`，拿到的 request / response 形态不稳定；
 * 而 `switchToHttp()` 给出的对象在 Fastify 与 Express 下都可用。
 * 因此请求级的横切逻辑（日志、响应包装）统一用**拦截器**实现，
 * 见 `core/src/interceptors/` 与 `libs/logger`。
 *
 * 只有确实无法用拦截器表达的诉求（例如需要在路由匹配**之前**改写原始请求，
 * 或挂第三方 Fastify 插件）才考虑在这里加中间件。
 */
export {};
