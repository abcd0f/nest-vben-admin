import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';
import { UserStatus } from './response.dto.js';

/**
 * 更新用户入参：所有字段可选，只传需要改的字段（PATCH 语义）。
 *
 * 用 `PartialType` 而不是手抄一遍字段：校验规则（长度、格式、枚举）在
 * `CreateUserDto` 是**单一事实来源**，这里再写一份必然漂移——
 * 典型症状是「新增时限制 64 位、更新时忘了加」，超长值只在更新路径上炸。
 *
 * 关于 `password`：本 DTO 保留可选的 `password`，`UserService.update()`
 * 会在检测到该字段时重新哈希。若业务上要求「改密码必须校验旧密码」，
 * 应另开 `PATCH /system/user/:id/password` 端点，不要在这个通用更新接口里
 * 掺入旧密码校验——那会让「只改昵称」的请求也被迫携带密码。
 *
 * 关于 `status`：它**不在** `CreateUserDto` 里，因为 `schema.prisma` 的
 * `status Int @default(1)` 已经把新建时的取值定死了（新增接口不接受该字段，
 * 传了会被 `whitelist` 剥掉）。但 `UserService.update()` 会写 `data.status`，
 * 所以必须在这里显式补上——否则「编辑用户时改状态」要么编译不过，
 * 要么被静默丢弃。
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {
  /**
   * 状态：1 正常，0 停用。null / 空串视为未传
   * @example 1
   */
  @IsOptional()
  @Type(() => String)
  @IsEnum(UserStatus, { message: '状态只能是 0（停用）或 1（正常）' })
  status?: UserStatus;
}
