import { asBoolean, asInteger, asList, asObject, asOptionalList, defineConfigDomain } from '../core/index.js';

const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];
const DEFAULT_MAX_AGE = 86400;

export interface CorsConfig {
  enabled: boolean;
  origin: '*' | string[];
  methods: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials: boolean;
  maxAge: number;
}

function normalizeOrigin(values: string[]): '*' | string[] {
  if (values.length === 1 && values[0] === '*') return '*';
  if (values.includes('*')) {
    throw new Error('cors.origin 不能把 "*" 和其他来源混用：要么只写 "*" 放行所有来源，要么列出白名单');
  }
  return values;
}

export const corsDomain = defineConfigDomain<CorsConfig>({
  namespace: 'cors',
  parse(raw): CorsConfig {
    const value = asObject(raw, 'cors');
    const origin = normalizeOrigin(asList(value.origin, 'cors.origin', ['*']));
    const enabled = asBoolean(value.enabled, 'cors.enabled', true);
    const credentials = asBoolean(value.credentials, 'cors.credentials', false);

    if (enabled && credentials && origin === '*') {
      throw new Error('cors.credentials 为 true 时不能把 origin 设为 "*"：请改为显式列出允许的来源');
    }

    return {
      enabled,
      origin,
      methods: asList(value.methods, 'cors.methods', DEFAULT_METHODS),
      allowedHeaders: asOptionalList(value['allowed-headers'], 'cors.allowed-headers'),
      exposedHeaders: asOptionalList(value['exposed-headers'], 'cors.exposed-headers'),
      credentials,
      maxAge: asInteger(value['max-age'], 'cors.max-age', DEFAULT_MAX_AGE, 0),
    };
  },
});

export const corsConfig = corsDomain.token;
