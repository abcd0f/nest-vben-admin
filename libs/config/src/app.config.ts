import type { EnvSource } from './env.utils.js';
import { registerAs } from '@nestjs/config';
import { collectEnvValue, enumValue, integerValue, throwEnvErrors } from './env.utils.js';

const NODE_ENVS = ['development', 'test', 'production'] as const;

export type NodeEnv = (typeof NODE_ENVS)[number];

export interface AppEnv {
  NODE_ENV: NodeEnv;
  PORT: number;
}

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  isProduction: boolean;
}

export function parseAppEnv(raw: EnvSource): AppEnv {
  const errors: string[] = [];
  const env = {
    NODE_ENV: collectEnvValue<NodeEnv>(errors, 'development', () =>
      enumValue(raw, 'NODE_ENV', NODE_ENVS, 'development')),
    PORT: collectEnvValue(errors, 3000, () => integerValue(raw, 'PORT', 3000, 1)),
  };

  throwEnvErrors(errors);
  return env;
}

export function createAppConfig(env: AppEnv): AppConfig {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    isProduction: env.NODE_ENV === 'production',
  };
}

export const appConfig = registerAs('app', (): AppConfig => createAppConfig(parseAppEnv(process.env)));
