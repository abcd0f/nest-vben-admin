import { defineConfigDomain } from '../core/index.js';

/**
 * 默认放行的方法。
 *
 * 必须显式给出：@fastify/cors 的默认值是 `GET,HEAD,POST`，
 * 直接沿用会让 PUT / PATCH / DELETE 的跨域请求在预检阶段被拒。
 */
const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];

/** 预检结果默认缓存 1 天（秒），减少 OPTIONS 往返 */
const DEFAULT_MAX_AGE = 86400;

export interface CorsConfig {
  enabled: boolean;
  /** `'*'` 放行所有来源；否则为白名单数组（精确匹配） */
  origin: '*' | string[];
  methods: string[];
  /** undefined = 反射请求头（保持 @fastify/cors 的默认行为） */
  allowedHeaders?: string[];
  /** undefined = 不设置 Access-Control-Expose-Headers */
  exposedHeaders?: string[];
  credentials: boolean;
  maxAge: number;
}

/** 只写了 `*` → 归一成 `'*'`；其余视为白名单。通配符与具体来源不允许混写 */
function normalizeOrigin(values: string[]): '*' | string[] {
  if (values.length === 1 && values[0] === '*') return '*';

  if (values.includes('*')) {
    throw new Error('cors.origin 不能把 "*" 和其他来源混用：要么只写 "*" 放行所有来源，要么列出白名单');
  }
  return values;
}

export const corsDomain = defineConfigDomain({
  namespace: 'cors',
  fields: {
    enabled: { type: 'boolean', default: true },
    origin: { type: 'list', default: ['*'] },
    credentials: { type: 'boolean', default: false },
    methods: { type: 'list', default: DEFAULT_METHODS },
    allowedHeaders: { type: 'list', optional: true },
    exposedHeaders: { type: 'list', optional: true },
    maxAge: { type: 'integer', default: DEFAULT_MAX_AGE, min: 0 },
  },
  resolve: (values): CorsConfig => {
    const origin = normalizeOrigin(values.origin);

    // 「通配来源 + 携带凭据」会被浏览器直接拒绝（Access-Control-Allow-Origin 不能是 *），
    // 属于配置矛盾，启动时 fail-fast 而不是等前端报错再排查。仅在启用时才校验，
    // 免得关掉 CORS 还要被迫先清理历史配置。
    if (values.enabled && values.credentials && origin === '*') {
      throw new Error('cors.credentials 为 true 时不能把 origin 设为 "*"：请改为显式列出允许的来源');
    }

    return {
      enabled: values.enabled,
      origin,
      methods: values.methods,
      allowedHeaders: values.allowedHeaders,
      exposedHeaders: values.exposedHeaders,
      credentials: values.credentials,
      maxAge: values.maxAge,
    };
  },
});

export const corsConfig = corsDomain.token;
