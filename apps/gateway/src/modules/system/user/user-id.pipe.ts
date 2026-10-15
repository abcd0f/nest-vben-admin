import { BusinessException } from '@app/core';
import { Injectable, PipeTransform } from '@nestjs/common';

const MAX_BIGINT_ID = 9223372036854775807n;

@Injectable()
export class UserIdPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (!/^[1-9]\d*$/.test(value)) {
      throw BusinessException.badRequest('用户 ID 必须是正整数十进制字符串');
    }

    const id = BigInt(value);
    if (id > MAX_BIGINT_ID) {
      throw BusinessException.badRequest('用户 ID 超出 BIGINT 范围');
    }

    return id;
  }
}
