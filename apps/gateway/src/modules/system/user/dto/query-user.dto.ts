import { Transform, Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../../dto/page-query.dto.js';
import { toOptionalNumber } from '../../../../dto/transform.util.js';
import { UserStatus } from './response.dto.js';

/**
 * 用户列表查询入参 = 分页参数 + 业务筛选条件。
 *
 * 继承 `PageQueryDto` 而不是重新声明 `page` / `pageSize`：
 * 分页的默认值、上限、类型转换规则只在 `PageQueryDto` 定义一次，
 * 各列表接口共用，避免出现「A 接口上限 200、B 接口上限 100」这种漂移。
 *
 * 全部筛选条件都是可选的，且**空值按未传处理**：
 * - 字符串条件（username / email / nickname）由 service 的 `buildWhere()` 归一化，
 *   空串会被丢掉，否则 `contains: ''` 会命中全表；
 * - `status` 是数字，归一化必须在 DTO 层做——`Number('') === 0`，
 *   直接 `@Type(() => Number)` 会让「清空筛选」变成「筛选停用用户」，
 *   详见 `toOptionalNumber()`。
 */
export class QueryUserDto extends PageQueryDto {
  /**
   * 用户名，模糊匹配
   * @example admin
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  /**
   * 邮箱，模糊匹配
   * @example admin@example.com
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  email?: string;

  /**
   * 昵称，模糊匹配
   * @example 管理员
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  /**
   * 状态：1 正常，0 停用。空串 / 缺省视为「不筛选」
   * @example 1
   */
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => toOptionalNumber(value))
  @IsEnum(UserStatus, { message: '状态只能是 0（停用）或 1（正常）' })
  status?: UserStatus;
}
