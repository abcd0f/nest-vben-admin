/**
 * 统一成功响应结构。
 *
 * 由 `ResponseInterceptor` 自动包装，业务代码只负责返回数据本身。
 * 前端（vben）的响应拦截器按 `code === 0` 判断成功，按 `data` 取业务数据。
 */
export interface ApiResponse<T = unknown> {
  /** 业务状态码，`0` 表示成功 */
  code: number;
  /** 提示信息 */
  message: string;
  /** 业务数据；无数据时为 `null`（不省略字段，前端少一层判空分支） */
  data: T | null;
}

/**
 * 统一错误响应结构。
 *
 * 比成功响应多带排查所需的上下文。**不包含**原始堆栈——
 * 堆栈只进日志文件，出网就等于把内部实现细节交给攻击者。
 */
export interface ApiErrorResponse {
  /** 业务状态码，见 `ResultCode` */
  code: number;
  /** 提示信息 */
  message: string;
  /** 固定为 `null`，保证错误响应与成功响应结构一致 */
  data: null;
  /** 详细错误：参数校验失败时为字段级错误列表 */
  details?: unknown;
  /** 请求追踪 ID，与响应头 `x-request-id` 一致 */
  requestId?: string;
  /** ISO 8601 时间戳 */
  timestamp: string;
  /** 请求路径 */
  path: string;
  /** 请求方法 */
  method: string;
}

/**
 * 判断一个值是否已经是统一响应结构。
 *
 * `ResponseInterceptor` 用它避免对已包装的响应二次包装——
 * 少数接口（如聚合多个下游服务的 BFF）会自行拼装 `ApiResponse`，
 * 拦截器必须能识别并原样透传。
 *
 * 判定条件刻意收紧到「三个键同时存在且 code 是数字」：
 * 业务数据恰好叫 `code` 是可能的，但同时又带 `message` 和 `data` 的概率极低。
 */
export function isApiResponse(value: unknown): value is ApiResponse {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === 'number' && 'message' in candidate && 'data' in candidate;
}
