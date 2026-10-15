import { Permission } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserIdPipe } from '../user/user-id.pipe.js';
import { PostDto } from './post.dto.js';
import { PostService } from './post.service.js';

@Controller('system/post')
export class PostController {
  constructor(private readonly service: PostService) {}
  @Get()
  @Permission('system:post:list')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permission('system:post:query')
  findOne(@Param('id', UserIdPipe) id: bigint) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission('system:post:create')
  create(@Body() dto: PostDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Permission('system:post:update')
  update(@Param('id', UserIdPipe) id: bigint, @Body() dto: Partial<PostDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission('system:post:delete')
  remove(@Param('id', UserIdPipe) id: bigint) {
    return this.service.remove(id);
  }
}
