import { ApiProperty } from '@nestjs/swagger';

/**
 * 统一错误响应体。
 *
 * 形状刻意对齐 Nest 默认的 `HttpException` 序列化结果
 * （`{ statusCode, message, error }`），因此**不需要**额外的异常过滤器就能和实际响应一致。
 * 将来若引入全局异常过滤器改变了错误结构，改这一个类即可。
 */
export class ApiErrorDto {
  @ApiProperty({ description: 'HTTP 状态码', example: 400 })
  statusCode!: number;

  @ApiProperty({
    description: '错误信息。参数校验失败时是字符串数组（每个字段一条）',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Bad Request',
  })
  message!: string | string[];

  @ApiProperty({ description: '错误类型（HTTP 状态短语）', example: 'Bad Request' })
  error!: string;
}
