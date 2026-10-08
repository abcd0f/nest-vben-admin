export type EnvSource = Record<string, unknown>;

function missing(raw: EnvSource, key: string): boolean {
  return raw[key] === undefined;
}

function invalid(key: string, expected: string): never {
  throw new Error(`${key}: ${expected}`);
}

export function collectEnvValue<T>(errors: string[], fallback: T, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return fallback;
  }
}

export function throwEnvErrors(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

export function stringValue(raw: EnvSource, key: string, defaultValue?: string, minLength = 0): string {
  if (missing(raw, key)) {
    if (defaultValue !== undefined) return defaultValue;
    return invalid(key, '必填');
  }

  const value = raw[key];
  if (typeof value !== 'string') return invalid(key, '必须是字符串');
  if (value.length < minLength) return invalid(key, `长度至少为 ${minLength}`);
  return value;
}

export function optionalString(raw: EnvSource, key: string, trim = false): string | undefined {
  if (missing(raw, key)) return undefined;

  const value = raw[key];
  if (typeof value !== 'string') return invalid(key, '必须是字符串');
  const normalized = trim ? value.trim() : value;
  return normalized === '' ? undefined : normalized;
}

export function enumValue<const T extends readonly string[]>(
  raw: EnvSource,
  key: string,
  values: T,
  defaultValue?: T[number],
): T[number] {
  if (missing(raw, key)) {
    if (defaultValue !== undefined) return defaultValue;
    return invalid(key, `必须是以下值之一：${values.join(', ')}`);
  }

  const value = raw[key];
  if (typeof value !== 'string' || !values.includes(value)) {
    return invalid(key, `必须是以下值之一：${values.join(', ')}`);
  }
  return value;
}

export function optionalEnum<const T extends readonly string[]>(
  raw: EnvSource,
  key: string,
  values: T,
): T[number] | undefined {
  if (missing(raw, key)) return undefined;
  return enumValue(raw, key, values);
}

export function integerValue(raw: EnvSource, key: string, defaultValue: number, minimum: number): number {
  if (missing(raw, key)) return defaultValue;

  const value = Number(raw[key]);
  if (!Number.isInteger(value) || value < minimum) {
    return invalid(key, minimum > 0 ? `必须是大于等于 ${minimum} 的整数` : `必须是非负整数`);
  }
  return value;
}

export function booleanValue(raw: EnvSource, key: string, defaultValue: boolean): boolean {
  if (missing(raw, key)) return defaultValue;

  const value = raw[key];
  if (value === 'true') return true;
  if (value === 'false') return false;
  return invalid(key, '只能是 true 或 false');
}

export function parseCsvList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
