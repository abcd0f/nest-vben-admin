import { Global, Module } from '@nestjs/common';
import { UserModule } from './user/user.module.js';
import { DeptModule } from './dept/dept.module.js';
import { PostModule } from './post/post.module.js';

@Global()
@Module({
  imports: [UserModule, DeptModule, PostModule],
})
export class SystemModule {}
