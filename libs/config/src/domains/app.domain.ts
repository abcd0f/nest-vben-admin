import type { Environment } from '../core/index.js';
import { defineConfigDomain } from '../core/index.js';

/** 与 `core/types.ts` 的 `ENVIRONMENTS` 一致；从 app 域导出以维持既有契约 */
export type NodeEnv = Environment;

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  isProduction: boolean;
}

/**
 * 应用基础域。
 *
 * 注意这里**没有** `node-env` 字段：环境名来自 `NODE_ENV`（由启动脚本注入），
 * 它决定加载哪份 `config/<env>.yaml`，是选择信号而非配置项，不该有两处来源。
 */
export const appDomain = defineConfigDomain({
  namespace: 'app',
  fields: {
    port: { type: 'integer', default: 3000, min: 1 },
  },
  resolve: (values, context): AppConfig => ({
    nodeEnv: context.environment,
    port: values.port,
    isProduction: context.environment === 'production',
  }),
});

/** 注入令牌：`@Inject(appConfig.KEY)`，也可走 `configService.get('app.port')` */
export const appConfig = appDomain.token;
