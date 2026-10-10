import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';

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
 * 3. **`id` 用 `ParseUUIDPipe`**。主键是 uuid 而非自增整数，非法格式（如 `/system/user/1`）
 *    必须在进 service 之前就被拦成 400，而不是把 `'1'` 当成合法 uuid 丢给数据库
 *    换回一个 `invalid input syntax for type uuid` 的 500。
 * 4. **错误一律靠抛异常**：`UserService` 抛 `BusinessException`，
 *    由 `AllExceptionsFilter` 统一序列化成 `ApiErrorResponse`，这里不做 try/catch。
 */
@Controller('system/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 新增用户
   *
   * @remarks 密码按原样落库，不做哈希。用户名、邮箱全局唯一，
   * 冲突时返回业务码 409。入参约束见 `CreateUserDto`，违反约束返回 422 + 字段级 `details`。
   */
  @Post()
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(createUserDto);
  }

  /**
   * 用户列表（分页）
   *
   * @remarks 支持用户名 / 邮箱 / 昵称模糊匹配与状态等值筛选，默认按创建时间倒序。
   * 筛选条件传空串等同于「不筛选」。分页参数由 `PageQueryDto` 校验：缺省为 1 / 20，
   * `pageSize` 上限 200，非法或越界取值返回 422（不做静默截断）。
   * 已软删除（`deletedAt` 非空）的用户不会出现在结果里。
   */
  @Get()
  findPage(@Query() query: QueryUserDto): Promise<UserPageDto> {
    return this.userService.findPage(query);
  }

  /**
   * 用户详情
   *
   * @remarks 返回体不含 `password`、`deletedAt`。目标不存在或已软删除时返回 404。
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.userService.findOne(id);
  }

  /**
   * 更新用户
   *
   * @remarks PATCH 语义：只更新请求体里出现的字段。传了 `password` 会直接更新密码；
   * 用户名 / 邮箱改动时会重新做唯一性校验，且不会与自身当前值冲突。
   * `email` / `nickname` 可空，传 `null` 表示清空该列；`username` / `status` 是
   * NOT NULL 列，传 `null` 会被忽略（视为未传）。
   */
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    return this.userService.update(id, updateUserDto);
  }

  /**
   * 删除用户（软删除）
   *
   * @remarks 只写 `deletedAt`，数据行保留以便追溯与恢复；重复删除返回 404。
   * 注意：被删除的用户名 / 邮箱仍占用唯一索引，重建同名用户会被拒绝。
   */
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
