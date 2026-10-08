export * from './config.module.js';

// 配置域：每个域一个文件，各自拥有「环境变量契约 + 强类型配置对象」
export * from './domains/app.config.js';
export * from './domains/database.config.js';
export * from './domains/logger.config.js';
export * from './domains/swagger.config.js';

// 环境变量的汇总契约、校验与共享工具
export * from './env/env.schema.js';
export * from './env/env.utils.js';
export * from './env/env.validation.js';
