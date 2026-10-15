import { Injectable, PipeTransform } from '@nestjs/common';
import { BusinessException } from '../exceptions/index.js';

const MAX_BIGINT_ID = 9223372036854775807n;

/**
 * 把路径参数中的十进制 ID 字符串解析为 `bigint`。
 *
 * 为什么不用 `@Param('id', ParseIntPipe)`：JS 的 `number` 在超过
 * `Number.MAX_SAFE_INTEGER`（2^53-1）后无法精确表示，雪花 ID 会静默失真。
 * 这里统一走 `bigint`，并显式卡住 BIGINT 上限。
 */
@Injectable()
export class BigIntIdPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (!/^[1-9]\d*$/.test(value)) {
      throw BusinessException.badRequest('ID 必须是正整数十进制字符串');
    }

    const id = BigInt(value);
    if (id > MAX_BIGINT_ID) {
      throw BusinessException.badRequest('ID 超出 BIGINT 范围');
    }

    return id;
  }
}
