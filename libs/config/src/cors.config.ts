import type { EnvSource } from './env.utils.js';
import { registerAs } from '@nestjs/config';
import {
  booleanValue,
  collectEnvValue,
  integerValue,
  optionalString,
  parseCsvList,
  stringValue,
  throwEnvErrors,
} from './env.utils.js';

/**
 * 默认放行的方法。
 *
 * 必须显式给出：@fastify/cors 的默认值是 `GET,HEAD,POST`，
 * 直接沿用会让 PUT / PATCH / DELETE 的跨域请求在预检阶段被拒。
 */
const DEFAULT_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';

/** 预检结果默认缓存 1 天（秒），减少 OPTIONS 往返 */
const DEFAULT_MAX_AGE = 86400;

/** CORS 域原始环境变量 */
export interface CorsEnv {
  /** 是否启用跨域。不声明 = 启用 */
  CORS_ENABLED: boolean;
  /** 允许的来源：`*` 表示全部，或逗号分隔的白名单 */
  CORS_ORIGIN: string;
  /** 是否允许携带凭据（Cookie / Authorization）。与 `CORS_ORIGIN=*` 互斥 */
  CORS_CREDENTIALS: boolean;
  /** 允许的方法，逗号分隔 */
  CORS_METHODS: string;
  /** 允许的请求头，逗号分隔。不声明 = 反射浏览器实际请求的头 */
  CORS_ALLOWED_HEADERS?: string;
  /** 暴露给前端的响应头，逗号分隔。不声明 = 不额外暴露 */
  CORS_EXPOSED_HEADERS?: string;
  /** 预检结果缓存秒数 */
  CORS_MAX_AGE: number;
}

/** CORS 域解析后的配置 */
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

export function parseCorsEnv(raw: EnvSource): CorsEnv {
  const errors: string[] = [];
  const env = {
    CORS_ENABLED: collectEnvValue(errors, true, () => booleanValue(raw, 'CORS_ENABLED', true)),
    CORS_ORIGIN: collectEnvValue(errors, '*', () => stringValue(raw, 'CORS_ORIGIN', '*', 1)),
    CORS_CREDENTIALS: collectEnvValue(errors, false, () => booleanValue(raw, 'CORS_CREDENTIALS', false)),
    CORS_METHODS: collectEnvValue(errors, DEFAULT_METHODS, () => stringValue(raw, 'CORS_METHODS', DEFAULT_METHODS, 1)),
    CORS_ALLOWED_HEADERS: collectEnvValue(errors, undefined, () => optionalString(raw, 'CORS_ALLOWED_HEADERS', true)),
    CORS_EXPOSED_HEADERS: collectEnvValue(errors, undefined, () => optionalString(raw, 'CORS_EXPOSED_HEADERS', true)),
    CORS_MAX_AGE: collectEnvValue(errors, DEFAULT_MAX_AGE, () => integerValue(raw, 'CORS_MAX_AGE', DEFAULT_MAX_AGE, 0)),
  };

  throwEnvErrors(errors);
  return env;
}

/** `*` 原样保留；否则切成白名单数组，空列表视为配置错误 */
function normalizeCorsOrigin(value: string): '*' | string[] {
  const trimmed = value.trim();
  if (trimmed === '*') return '*';

  const origins = parseCsvList(trimmed);
  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN 不能为空：要么写 * 放行所有来源，要么列出至少一个允许的来源');
  }
  return origins;
}

export function createCorsConfig(env: CorsEnv): CorsConfig {
  const origin = normalizeCorsOrigin(env.CORS_ORIGIN);

  // 「通配来源 + 携带凭据」会被浏览器直接拒绝（Access-Control-Allow-Origin 不能是 *），
  // 属于配置矛盾，启动时 fail-fast 而不是等前端报错再排查。仅在启用时才校验，
  // 免得关掉 CORS 还要被迫先清理历史配置。
  if (env.CORS_ENABLED && env.CORS_CREDENTIALS && origin === '*') {
    throw new Error(
      'CORS_CREDENTIALS=true 时不能使用 CORS_ORIGIN=*：请改为显式列出允许的来源（如 http://localhost:5173）',
    );
  }

  return {
    enabled: env.CORS_ENABLED,
    origin,
    methods: parseCsvList(env.CORS_METHODS),
    allowedHeaders: env.CORS_ALLOWED_HEADERS ? parseCsvList(env.CORS_ALLOWED_HEADERS) : undefined,
    exposedHeaders: env.CORS_EXPOSED_HEADERS ? parseCsvList(env.CORS_EXPOSED_HEADERS) : undefined,
    credentials: env.CORS_CREDENTIALS,
    maxAge: env.CORS_MAX_AGE,
  };
}

export const corsConfig = registerAs('cors', (): CorsConfig => createCorsConfig(parseCorsEnv(process.env)));
