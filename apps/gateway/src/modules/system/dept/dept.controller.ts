import { BigIntIdPipe } from '@app/core';
import { Permission } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DeptService } from './dept.service.js';
import { DeptDto } from './dto.js';

@Controller('system/dept')
export class DeptController {
  constructor(private readonly service: DeptService) {}
  @Get()
  @Permission('system:dept:list')
  findAll() {
    return this.service.findAll();
  }

  @Get(':deptId')
  @Permission('system:dept:query')
  findOne(@Param('deptId', BigIntIdPipe) id: bigint) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission('system:dept:create')
  create(@Body() dto: DeptDto) {
    return this.service.create(dto);
  }

  @Patch(':deptId')
  @Permission('system:dept:update')
  update(@Param('deptId', BigIntIdPipe) id: bigint, @Body() dto: Partial<DeptDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':deptId')
  @Permission('system:dept:delete')
  remove(@Param('deptId', BigIntIdPipe) id: bigint) {
    return this.service.remove(id);
  }
}
