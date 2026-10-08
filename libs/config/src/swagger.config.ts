import type { EnvSource } from './env.utils.js';
import { registerAs } from '@nestjs/config';
import {
  booleanValue,
  collectEnvValue,
  optionalEnum,
  optionalString,
  stringValue,
  throwEnvErrors,
} from './env.utils.js';

export interface SwaggerEnv {
  SWAGGER_ENABLED?: 'true' | 'false';
  SWAGGER_PATH: string;
  SWAGGER_TITLE: string;
  SWAGGER_DESCRIPTION: string;
  SWAGGER_VERSION: string;
  SWAGGER_SERVER_URL?: string;
  SWAGGER_JSON_URL?: string;
  SWAGGER_YAML_URL?: string;
  SWAGGER_PERSIST_AUTHORIZATION: boolean;
}

export interface SwaggerConfig {
  enabled: boolean;
  /** 归一化后的路径，不含前后斜杠 */
  path: string;
  title: string;
  description: string;
  version: string;
  serverUrl?: string;
  jsonUrl: string;
  yamlUrl: string;
  persistAuthorization: boolean;
}

export function parseSwaggerEnv(raw: EnvSource): SwaggerEnv {
  const errors: string[] = [];
  const env = {
    SWAGGER_ENABLED: collectEnvValue(errors, undefined, () =>
      optionalEnum(raw, 'SWAGGER_ENABLED', ['true', 'false'] as const)),
    SWAGGER_PATH: collectEnvValue(errors, 'docs', () => stringValue(raw, 'SWAGGER_PATH', 'docs', 1)),
    SWAGGER_TITLE: collectEnvValue(errors, 'Nest Vben Admin API', () =>
      stringValue(raw, 'SWAGGER_TITLE', 'Nest Vben Admin API', 1)),
    SWAGGER_DESCRIPTION: collectEnvValue(errors, '', () => stringValue(raw, 'SWAGGER_DESCRIPTION', '')),
    SWAGGER_VERSION: collectEnvValue(errors, '1.0.0', () => stringValue(raw, 'SWAGGER_VERSION', '1.0.0', 1)),
    SWAGGER_SERVER_URL: collectEnvValue(errors, undefined, () => optionalString(raw, 'SWAGGER_SERVER_URL', true)),
    SWAGGER_JSON_URL: collectEnvValue(errors, undefined, () => optionalString(raw, 'SWAGGER_JSON_URL', true)),
    SWAGGER_YAML_URL: collectEnvValue(errors, undefined, () => optionalString(raw, 'SWAGGER_YAML_URL', true)),
    SWAGGER_PERSIST_AUTHORIZATION: collectEnvValue(errors, true, () =>
      booleanValue(raw, 'SWAGGER_PERSIST_AUTHORIZATION', true)),
  };

  throwEnvErrors(errors);
  return env;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export function createSwaggerConfig(env: SwaggerEnv, nodeEnv = process.env.NODE_ENV): SwaggerConfig {
  const path = trimSlashes(env.SWAGGER_PATH);

  return {
    enabled: env.SWAGGER_ENABLED === undefined ? nodeEnv !== 'production' : env.SWAGGER_ENABLED === 'true',
    path,
    title: env.SWAGGER_TITLE,
    description: env.SWAGGER_DESCRIPTION,
    version: env.SWAGGER_VERSION,
    serverUrl: env.SWAGGER_SERVER_URL,
    jsonUrl: trimSlashes(env.SWAGGER_JSON_URL ?? `${path}/json`),
    yamlUrl: trimSlashes(env.SWAGGER_YAML_URL ?? `${path}/yaml`),
    persistAuthorization: env.SWAGGER_PERSIST_AUTHORIZATION,
  };
}

export const swaggerConfig = registerAs('swagger', (): SwaggerConfig =>
  createSwaggerConfig(parseSwaggerEnv(process.env)));
