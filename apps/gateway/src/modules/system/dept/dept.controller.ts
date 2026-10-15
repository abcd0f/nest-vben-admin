import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserIdPipe } from '../user/user-id.pipe.js';
import { DeptService } from './dept.service.js';
import { DeptDto } from './dto.js';

@Controller('system/dept')
export class DeptController {
  constructor(private readonly service: DeptService) {}
  @Get() findAll() {
    return this.service.findAll();
  }

  @Get(':deptId') findOne(@Param('deptId', UserIdPipe) id: bigint) {
    return this.service.findOne(id);
  }

  @Post() create(@Body() dto: DeptDto) {
    return this.service.create(dto);
  }

  @Patch(':deptId') update(@Param('deptId', UserIdPipe) id: bigint, @Body() dto: Partial<DeptDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':deptId') remove(@Param('deptId', UserIdPipe) id: bigint) {
    return this.service.remove(id);
  }
}
