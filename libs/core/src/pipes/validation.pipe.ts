import type { ValidationPipeOptions } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { Injectable, ValidationPipe } from '@nestjs/common';
import { ResultCode } from '../constants/index.js';
import { BusinessException } from '../exceptions/index.js';

/** 字段级校验错误 */
export interface FieldValidationError {
  /** 字段路径，嵌套字段用 `.` 连接（如 `filter.status`） */
  field: string;
  /** 提示信息 */
  message: string;
}

/**
 * 把 class-validator 的嵌套错误树拍平成「字段 → 提示」的平铺列表。
 *
 * 递归展开 `children` 是必须的：校验嵌套 DTO 时，class-validator 只在顶层
 * `constraints` 里放「对象本身」的错误，真正的字段错误全在 children 里，
 * 不递归的话前端只能收到一条「嵌套校验失败」这种没法定位的信息。
 */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldValidationError[] {
  const result: FieldValidationError[] = [];

  for (const error of errors) {
    const path = parent.length > 0 ? `${parent}.${error.property}` : error.property;

    for (const message of Object.values(error.constraints ?? {})) {
      result.push({ field: path, message });
    }

    if (error.children !== undefined && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, path));
    }
  }

  return result;
}

/** 全局校验管道的默认选项 */
export function createValidationPipeOptions(overrides: ValidationPipeOptions = {}): ValidationPipeOptions {
  return {
    // 把 query / param 的字符串转成 DTO 上声明的类型
    transform: true,
    // 剥掉 DTO 未声明的字段，避免「前端多传一个字段就写进数据库」
    whitelist: true,
    // 不因多余字段直接 400：前端做灰度 / 埋点时多带参数很常见，剥掉即可
    forbidNonWhitelisted: false,
    transformOptions: { enableImplicitConversion: true },
    ...overrides,
    // exceptionFactory 放在最后且不可被覆盖：错误响应格式必须全局唯一，
    // 允许各模块自定义会立刻退化成「每个接口一种错误结构」。
    exceptionFactory: (errors: ValidationError[]) =>
      new BusinessException(ResultCode.UNPROCESSABLE_ENTITY, '请求参数校验失败', {
        details: flattenValidationErrors(errors),
      }),
  };
}

/**
 * 全局参数校验管道。
 *
 * 由 `CoreModule` 通过 `APP_PIPE` 注册，业务代码不需要手动 `@UsePipes()`。
 *
 * 与 Swagger 的关系：DTO 上的 `@IsInt` / `@Min` 这类装饰器原本只用于生成文档，
 * 挂上本管道后**同时具备运行期约束力**——文档与行为不再可能漂移。
 *
 * 构造函数刻意不接收参数（也不加 `@Inject`）：`useClass` 注册时 Nest 会按
 * `design:paramtypes` 解析依赖，而 `ValidationPipeOptions` 是接口、编译后是
 * `Object`，会被当成一个解析不到的 provider token。要自定义选项请改
 * `createValidationPipeOptions()`，或在 CoreModule 里改用 `useFactory`。
 */
@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super(createValidationPipeOptions());
  }
}
