import { HttpStatus } from '@nestjs/common';

/**
 * 统一业务状态码。
 *
 * 约定（与前端 vben 的响应拦截器对齐）：
 * - `0` = 成功，其余一律视为失败。前端只判断 `code === 0`。
 * - `400 ~ 599` 直接复用 HTTP 语义码：看到业务码就知道该配什么 HTTP 状态，
 *   不需要额外维护一张「业务码 → HTTP 码」的映射表。
 * - `10000` 起为纯业务码，不占用协议语义段，避免两者混淆。
 *
 * 使用边界：本枚举只放**跨业务通用**的码。某个业务域专属的码
 * （如「订单已支付不能取消」）由该业务 lib 自行定义，取值从 20000 起分段，
 * 不要往这里塞——否则这个枚举会变成谁都不敢删的垃圾场。
 */
export enum ResultCode {
  /** 成功 */
  SUCCESS = 0,

  // ---------- 客户端错误：与 HTTP 状态码对齐 ----------

  /** 请求参数错误 */
  BAD_REQUEST = 400,
  /** 未认证：缺少凭证，或凭证已失效 */
  UNAUTHORIZED = 401,
  /** 已认证但无权限访问该资源 */
  FORBIDDEN = 403,
  /** 资源不存在 */
  NOT_FOUND = 404,
  /** 请求方法不被支持 */
  METHOD_NOT_ALLOWED = 405,
  /** 资源冲突：唯一键重复、并发写冲突等 */
  CONFLICT = 409,
  /** 请求体过大 */
  PAYLOAD_TOO_LARGE = 413,
  /** 参数校验失败 */
  UNPROCESSABLE_ENTITY = 422,
  /** 请求过于频繁，触发限流 */
  TOO_MANY_REQUESTS = 429,

  // ---------- 服务端错误：与 HTTP 状态码对齐 ----------

  /** 未捕获的服务端异常 */
  INTERNAL_SERVER_ERROR = 500,
  /** 功能未实现 */
  NOT_IMPLEMENTED = 501,
  /** 上游服务返回异常 */
  BAD_GATEWAY = 502,
  /** 服务暂不可用（依赖未就绪、正在重启等） */
  SERVICE_UNAVAILABLE = 503,
  /** 上游服务超时 */
  GATEWAY_TIMEOUT = 504,

  // ---------- 业务错误：10000 起 ----------

  /** 业务处理失败（通用兜底） */
  BUSINESS_ERROR = 10000,
  /** 数据已存在 */
  DATA_ALREADY_EXISTS = 10001,
  /** 数据不存在 */
  DATA_NOT_FOUND = 10002,
  /** 当前状态下不允许该操作 */
  OPERATION_NOT_ALLOWED = 10003,
  /** 用户名或密码错误 */
  LOGIN_FAILED = 10010,
  /** 账号已被禁用 */
  ACCOUNT_DISABLED = 10011,
  /** 令牌已过期，需要重新登录 */
  TOKEN_EXPIRED = 10012,
  /** 令牌无效 */
  TOKEN_INVALID = 10013,
  /** 验证码错误或已过期 */
  CAPTCHA_INVALID = 10014,
}

/** 各状态码的默认提示语；业务侧没显式给 message 时用它。 */
const DEFAULT_MESSAGES: Readonly<Record<number, string>> = {
  [ResultCode.SUCCESS]: '操作成功',

  [ResultCode.BAD_REQUEST]: '请求参数错误',
  [ResultCode.UNAUTHORIZED]: '未登录或登录已过期',
  [ResultCode.FORBIDDEN]: '没有权限执行该操作',
  [ResultCode.NOT_FOUND]: '请求的资源不存在',
  [ResultCode.METHOD_NOT_ALLOWED]: '请求方法不被支持',
  [ResultCode.CONFLICT]: '资源状态冲突',
  [ResultCode.PAYLOAD_TOO_LARGE]: '请求体过大',
  [ResultCode.UNPROCESSABLE_ENTITY]: '请求参数校验失败',
  [ResultCode.TOO_MANY_REQUESTS]: '请求过于频繁，请稍后再试',

  [ResultCode.INTERNAL_SERVER_ERROR]: '服务器内部错误',
  [ResultCode.NOT_IMPLEMENTED]: '功能暂未实现',
  [ResultCode.BAD_GATEWAY]: '上游服务异常',
  [ResultCode.SERVICE_UNAVAILABLE]: '服务暂不可用',
  [ResultCode.GATEWAY_TIMEOUT]: '上游服务超时',

  [ResultCode.BUSINESS_ERROR]: '业务处理失败',
  [ResultCode.DATA_ALREADY_EXISTS]: '数据已存在',
  [ResultCode.DATA_NOT_FOUND]: '数据不存在',
  [ResultCode.OPERATION_NOT_ALLOWED]: '当前状态下不允许该操作',
  [ResultCode.LOGIN_FAILED]: '用户名或密码错误',
  [ResultCode.ACCOUNT_DISABLED]: '账号已被禁用',
  [ResultCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  [ResultCode.TOKEN_INVALID]: '登录凭证无效',
  [ResultCode.CAPTCHA_INVALID]: '验证码错误或已过期',
};

/** 取状态码的默认提示语；未登记的码回落为通用文案。 */
export function resultCodeMessage(code: number): string {
  return DEFAULT_MESSAGES[code] ?? '请求处理失败';
}

/**
 * 由业务码推导 HTTP 状态码。
 *
 * - `0` → 200
 * - `400 ~ 599` → 原样返回（本就是协议码）
 * - 其余（业务码）→ 400：业务失败属于「请求无法被正确处理」，
 *   用 4xx 而非 200，避免网关 / CDN / 监控把失败请求统计成成功。
 */
export function resolveHttpStatus(code: number): number {
  if (code === ResultCode.SUCCESS) {
    return HttpStatus.OK;
  }

  if (code >= HttpStatus.BAD_REQUEST && code <= 599) {
    return code;
  }

  return HttpStatus.BAD_REQUEST;
}
