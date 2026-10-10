import { Module } from '@nestjs/common';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

/**
 * 用户模块。
 *
 * - `PrismaService` 由 `@Global` 的 `DatabaseModule` 提供，这里无需 import；
 * - 本模块不再依赖任何密码哈希能力：`password` 由 `UserService` 按 DTO 原样落库。
 */
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
