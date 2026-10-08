import { CrypotModule } from '@app/crypot';
import { Module } from '@nestjs/common';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

/**
 * 用户模块。
 *
 * - `PrismaService` 由 `@Global` 的 `DatabaseModule` 提供，这里无需 import；
 * - `CrypotModule` **必须显式 import**：它没有标 `@Global`，而 `UserService`
 *   依赖 `CrypotService` 做密码哈希。漏掉这一行编译期不报错，
 *   启动时才炸 `Nest can't resolve dependencies of the UserService (PrismaService, ?)`。
 */
@Module({
  imports: [CrypotModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
