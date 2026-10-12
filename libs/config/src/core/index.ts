export { defineConfigDomain, toKebabCase } from './define-domain.js';
export { configSource, loadConfigSource, resetConfigSource, resolveEnvironment } from './source/index.js';
export { createYamlSource } from './source/yaml-source.js';
export { ENVIRONMENTS } from './types.js';
export type {
  AnyConfigDomain,
  ConfigDomain,
  ConfigSource,
  ConfigSourceValue,
  DomainDefinition,
  DomainParseResult,
  DomainValues,
  Environment,
  FieldLocator,
  FieldSpec,
  FieldSpecs,
  ResolveContext,
} from './types.js';
