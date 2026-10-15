import { asBoolean, asInteger, asObject, asString, defineConfigDomain } from '../core/index.js';

export interface AuthConfig {
  secret: string;
  tokenTtlSeconds: number;
  refreshToken: {
    enabled: boolean;
    ttlSeconds: number;
  };
}

export const authDomain = defineConfigDomain<AuthConfig>({
  namespace: 'auth',
  parse(raw, context): AuthConfig {
    const value = asObject(raw, 'auth');
    const secret = asString(value.secret, 'auth.secret', context.environment === 'production' ? undefined : 'development-only-change-me');
    if (context.environment === 'production' && secret === 'development-only-change-me') {
      throw new Error('生产环境必须配置 auth.secret');
    }
    const refresh = asObject(value['refresh-token'], 'auth.refresh-token');
    return {
      secret,
      tokenTtlSeconds: asInteger(value['token-ttl-seconds'], 'auth.token-ttl-seconds', 28_800, 60),
      refreshToken: {
        enabled: asBoolean(refresh.enabled, 'auth.refresh-token.enabled', false),
        ttlSeconds: asInteger(refresh['ttl-seconds'], 'auth.refresh-token.ttl-seconds', 604_800, 60),
      },
    };
  },
});

export const authConfig = authDomain.token;
