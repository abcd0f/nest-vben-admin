import { BigIntIdPipe } from '@app/core';
import { Permission, SystemAdmin } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CreateRoleDto, ReplaceIdsDto, UpdateRoleDto } from './dto/role.dto.js';
import { RoleService } from './role.service.js';

@Controller('system/role')
export class RoleController {
  constructor(private readonly service: RoleService) {}
  @Get()
  @Permission('system:role:list')
  findAll() {
    return this.service.findAll();
  }

  @Get(':roleId')
  @Permission('system:role:query')
  findOne(@Param('roleId', BigIntIdPipe) roleId: bigint) {
    return this.service.findOne(roleId);
  }

  @Post()
  @Permission('system:role:create')
  @SystemAdmin()
  create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }

  @Patch(':roleId')
  @Permission('system:role:update')
  @SystemAdmin()
  update(@Param('roleId', BigIntIdPipe) roleId: bigint, @Body() dto: UpdateRoleDto) {
    return this.service.update(roleId, dto);
  }

  @Delete(':roleId')
  @Permission('system:role:delete')
  @SystemAdmin()
  remove(@Param('roleId', BigIntIdPipe) roleId: bigint) {
    return this.service.remove(roleId);
  }

  @Put(':roleId/depts')
  @Permission('system:role:assign-depts')
  @SystemAdmin()
  replaceRoleDepts(@Param('roleId', BigIntIdPipe) roleId: bigint, @Body() dto: ReplaceIdsDto) {
    return this.service.replaceRoleDepts(roleId, dto);
  }

  @Get(':roleId/menus')
  @Permission('system:role:assign-menus')
  @SystemAdmin()
  findRoleMenus(@Param('roleId', BigIntIdPipe) roleId: bigint) {
    return this.service.findRoleMenus(roleId);
  }

  @Put(':roleId/menus')
  @Permission('system:role:assign-menus')
  @SystemAdmin()
  replaceRoleMenus(@Param('roleId', BigIntIdPipe) roleId: bigint, @Body() dto: ReplaceIdsDto) {
    return this.service.replaceRoleMenus(roleId, dto);
  }
}
