import { AuthModule } from '@app/auth';
import { PermissionModule } from '@app/permission';
import { Module } from '@nestjs/common';
import { RoleModule } from '../role/role.module.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

/**
 * 用户模块。
 *
 * - `PrismaService` 由 `@Global` 的 `DatabaseModule` 提供，这里无需 import；
 * - 通过 `AuthService` 统一处理密码哈希。
 */
@Module({
  imports: [AuthModule, PermissionModule, RoleModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
