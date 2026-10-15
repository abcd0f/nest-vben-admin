import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { UserIdPipe } from '../user/user-id.pipe.js';
import { CreateRoleDto, ReplaceIdsDto, UpdateRoleDto } from './role.dto.js';
import { RoleService } from './role.service.js';

@Controller('system/role')
export class RoleController {
  constructor(private readonly service: RoleService) {}
  @Get() findAll() {
    return this.service.findAll();
  }

  @Get(':roleId') findOne(@Param('roleId', UserIdPipe) roleId: bigint) {
    return this.service.findOne(roleId);
  }

  @Post() create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }

  @Patch(':roleId') update(@Param('roleId', UserIdPipe) roleId: bigint, @Body() dto: UpdateRoleDto) {
    return this.service.update(roleId, dto);
  }

  @Delete(':roleId') remove(@Param('roleId', UserIdPipe) roleId: bigint) {
    return this.service.remove(roleId);
  }

  @Put(':roleId/depts') replaceRoleDepts(@Param('roleId', UserIdPipe) roleId: bigint, @Body() dto: ReplaceIdsDto) {
    return this.service.replaceRoleDepts(roleId, dto);
  }

  @Get(':roleId/menus') findRoleMenus(@Param('roleId', UserIdPipe) roleId: bigint) {
    return this.service.findRoleMenus(roleId);
  }

  @Put(':roleId/menus') replaceRoleMenus(@Param('roleId', UserIdPipe) roleId: bigint, @Body() dto: ReplaceIdsDto) {
    return this.service.replaceRoleMenus(roleId, dto);
  }
}
