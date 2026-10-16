import { PermissionModule } from '@app/permission';
import { Module } from '@nestjs/common';
import { PostController } from './post.controller.js';
import { PostService } from './post.service.js';

@Module({
  imports: [PermissionModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
