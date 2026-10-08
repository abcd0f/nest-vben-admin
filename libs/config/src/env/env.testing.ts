/**
 * 临时覆盖 process.env，结束后原样还原。
 *
 * 为什么需要它：`registerAs` 的工厂在 @nestjs/config 内部以 `inject: []` 注册，
 * 拿不到 ConfigService，只能读 process.env。所以测配置域必须操作真实的环境变量，
 * 这个 helper 保证用例之间不互相污染。
 */
export function withEnv<T>(values: Record<string, string | undefined>, fn: () => T): T {
  const saved = Object.keys(values).map((key) => [key, process.env[key]] as const);

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
