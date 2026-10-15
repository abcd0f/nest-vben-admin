import { toOptionalNumber } from '@app/common';
import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';
import { UserStatus } from './response.dto.js';

/**
 * 更新用户入参：所有字段可选，只传需要改的字段（PATCH 语义）。
 *
 * 用 `PartialType` 而不是手抄一遍字段：校验规则（长度、格式、枚举）在
 * `CreateUserDto` 是**单一事实来源**，这里再写一份必然漂移——
 * 典型症状是「新增时限制 64 位、更新时忘了加」，超长值只在更新路径上炸。
 *
 * `password` 不属于通用更新；管理员重置和用户自助修改使用独立流程。
 *
 * 关于 `status`：它**不在** `CreateUserDto` 里，因为 `schema.prisma` 的
 * `status Int @default(1)` 已经把新建时的取值定死了（新增接口不接受该字段，
 * 传了会被 `whitelist` 剥掉）。但 `UserService.update()` 会写 `data.status`，
 * 所以必须在这里显式补上——否则「编辑用户时改状态」要么编译不过，
 * 要么被静默丢弃。
 */
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password', 'deptId'] as const)) {
  /**
   * 状态：1 正常，0 停用。null / 空串视为未传
   * @example 1
   */
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => toOptionalNumber(value))
  @IsEnum(UserStatus, { message: '状态只能是 0（停用）或 1（正常）' })
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: '部门 ID 必须是正整数十进制字符串' })
  deptId?: null | string;
}
