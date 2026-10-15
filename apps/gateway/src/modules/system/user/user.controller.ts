import { CurrentUser } from '@app/auth';
import { BigIntIdPipe } from '@app/core';
import { Permission, SystemAdmin } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ResetPasswordDto } from '../../auth/auth.dto.js';

import { ReplaceIdsDto } from '../role/dto/role.dto.js';
import { RoleService } from '../role/role.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { QueryUserDto } from './dto/query-user.dto.js';
import { UserPageDto, UserResponseDto } from './dto/response.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserService } from './user.service.js';

/**
 * 系统管理 —— 用户接口。
 *
 * 几个贯穿全控制器的约定：
 *
 * 1. **返回值就是业务数据本身**。运行期外层会被 `@app/core` 的
 *    `ResponseInterceptor` 包成 `{ code, message, data }`，controller 里不手动拼响应体。
 * 2. **文档零装饰器**。所有 description / example 来自本文件的 JSDoc 与方法签名，
 *    业务代码里不出现任何 `@Api*`。
 * 3. **`userId` 是 PostgreSQL BIGINT 自增主键**。HTTP 路径使用十进制字符串，
 *    在进入 service 前校验并转换为 bigint，避免大整数丢失精度。
 * 4. **错误一律靠抛异常**：`UserService` 抛 `BusinessException`，
 *    由 `AllExceptionsFilter` 统一序列化成 `ApiErrorResponse`，这里不做 try/catch。
 */
@Controller('system/user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  @Put(':userId/posts')
  @Permission('system:user:assign-posts')
  @SystemAdmin()
  replacePosts(@Param('userId', BigIntIdPipe) userId: bigint, @Body() dto: ReplaceIdsDto) {
    return this.roleService.replaceUserPosts(userId, dto);
  }

  @Put(':userId/roles')
  @Permission('system:user:assign-roles')
  @SystemAdmin()
  replaceRoles(@Param('userId', BigIntIdPipe) userId: bigint, @Body() dto: ReplaceIdsDto) {
    return this.roleService.replaceUserRoles(userId, dto);
  }

  /**
   * 新增用户
   *
   * @remarks 密码经过强哈希后落库。用户名、邮箱全局唯一，
   * 冲突时返回业务码 409。入参约束见 `CreateUserDto`，违反约束返回 422 + 字段级 `details`。
   */
  @Post()
  @Permission('system:user:create')
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() current: { userId: bigint }): Promise<UserResponseDto> {
    return this.userService.create(createUserDto, current.userId);
  }

  /**
   * 用户列表（分页）
   *
   * @remarks 支持用户名 / 邮箱 / 昵称模糊匹配与状态等值筛选，默认按创建时间倒序。
   * 筛选条件传空串等同于「不筛选」。分页参数由 `PageQueryDto` 校验：缺省为 1 / 20，
   * `pageSize` 上限 200，非法或越界取值返回 422（不做静默截断）。
   * 已软删除（`isDel = 1`）的用户不会出现在结果里。
   */
  @Get()
  @Permission('system:user:list')
  findPage(@Query() query: QueryUserDto, @CurrentUser() current: { userId: bigint }): Promise<UserPageDto> {
    return this.userService.findPage(query, current.userId);
  }

  /**
   * 用户详情
   *
   * @remarks 返回体不含 `password`、`isDel`。目标不存在或已软删除时返回 404。
   */
  @Get(':userId')
  @Permission('system:user:query')
  findOne(
    @Param('userId', BigIntIdPipe) userId: bigint,
    @CurrentUser() current: { userId: bigint },
  ): Promise<UserResponseDto> {
    return this.userService.findOne(userId, current.userId);
  }

  /**
   * 更新用户
   *
   * @remarks PATCH 语义：只更新请求体里出现的字段；密码不通过通用更新接口修改。
   * 用户名 / 邮箱改动时会重新做唯一性校验，且不会与自身当前值冲突。
   * `email` / `nickName` 可空，传 `null` 表示清空该列；`username` / `status` 是
   * NOT NULL 列，传 `null` 会被忽略（视为未传）。
   */
  @Patch(':userId')
  @Permission('system:user:update')
  update(
    @Param('userId', BigIntIdPipe) userId: bigint,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() current: { userId: bigint },
  ): Promise<UserResponseDto> {
    return this.userService.update(userId, updateUserDto, current.userId);
  }

  /**
   * 删除用户（软删除）
   *
   * @remarks 只写 `isDel = 1`，数据行保留以便追溯与恢复；重复删除返回 404。
   * 注意：被删除的用户名 / 邮箱仍占用唯一索引，重建同名用户会被拒绝。
   */
  @Delete(':userId')
  @Permission('system:user:delete')
  remove(@Param('userId', BigIntIdPipe) userId: bigint, @CurrentUser() current: { userId: bigint }): Promise<void> {
    return this.userService.remove(userId, current.userId);
  }

  @Patch(':userId/password/reset')
  @Permission('system:user:reset-password')
  @SystemAdmin()
  resetPassword(@Param('userId', BigIntIdPipe) userId: bigint, @Body() dto: ResetPasswordDto): Promise<void> {
    return this.userService.resetPassword(userId, dto.newPassword);
  }
}
