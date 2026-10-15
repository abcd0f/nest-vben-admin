import { asInteger, asObject, asString, defineConfigDomain } from '../core/index.js';

export interface AuthConfig {
  secret: string;
  tokenTtlSeconds: number;
}

export const authDomain = defineConfigDomain<AuthConfig>({
  namespace: 'auth',
  parse(raw, context): AuthConfig {
    const value = asObject(raw, 'auth');
    const secret = asString(value.secret, 'auth.secret', context.environment === 'production' ? undefined : 'development-only-change-me');
    if (context.environment === 'production' && secret === 'development-only-change-me') {
      throw new Error('生产环境必须配置 auth.secret');
    }
    return { secret, tokenTtlSeconds: asInteger(value['token-ttl-seconds'], 'auth.token-ttl-seconds', 28_800, 60) };
  },
});

export const authConfig = authDomain.token;
