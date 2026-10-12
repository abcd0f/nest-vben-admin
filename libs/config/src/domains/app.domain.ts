import { defineConfigDomain } from '../core/index.js';

const NODE_ENVS = ['development', 'test', 'production'] as const;

export type NodeEnv = (typeof NODE_ENVS)[number];

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  isProduction: boolean;
}

/**
 * 应用基础域。
 *
 * `envPrefix: ''` —— 该域的变量没有前缀，直接读 `NODE_ENV` / `PORT`。
 */
export const appDomain = defineConfigDomain({
  namespace: 'app',
  envPrefix: '',
  fields: {
    nodeEnv: { type: 'enum', values: NODE_ENVS, default: 'development' },
    port: { type: 'integer', default: 3000, min: 1 },
  },
  resolve: (values): AppConfig => ({
    nodeEnv: values.nodeEnv,
    port: values.port,
    isProduction: values.nodeEnv === 'production',
  }),
});

/** 注入令牌：`@Inject(appConfig.KEY)`，也可走 `configService.get('app.port')` */
export const appConfig = appDomain.token;
