import { Global, Module } from '@nestjs/common';
import { DeptModule } from './dept/dept.module.js';
import { PostModule } from './post/post.module.js';
import { RoleModule } from './role/role.module.js';
import { UserModule } from './user/user.module.js';

@Global()
@Module({
  imports: [UserModule, DeptModule, PostModule, RoleModule],
})
export class SystemModule {}
