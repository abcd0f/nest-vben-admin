import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserIdPipe } from '../user/user-id.pipe.js';
import { PostDto } from './post.dto.js';
import { PostService } from './post.service.js';

@Controller('system/post')
export class PostController {
  constructor(private readonly service: PostService) {}
  @Get() findAll() {
    return this.service.findAll();
  }

  @Get(':id') findOne(@Param('id', UserIdPipe) id: bigint) {
    return this.service.findOne(id);
  }

  @Post() create(@Body() dto: PostDto) {
    return this.service.create(dto);
  }

  @Patch(':id') update(@Param('id', UserIdPipe) id: bigint, @Body() dto: Partial<PostDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id') remove(@Param('id', UserIdPipe) id: bigint) {
    return this.service.remove(id);
  }
}
