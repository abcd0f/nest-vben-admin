import { Permission, SystemAdmin } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserIdPipe } from '../user/user-id.pipe.js';
import { MenuDto, UpdateMenuDto } from './menu.dto.js';
import { MenuService } from './menu.service.js';

@Controller('system/menu')
export class MenuController {
  constructor(private readonly service: MenuService) {}

  @Get()
  @Permission('system:menu:list')
  findAll() {
    return this.service.findAll();
  }

  @Get(':menuId')
  @Permission('system:menu:query')
  findOne(@Param('menuId', UserIdPipe) menuId: bigint) {
    return this.service.findOne(menuId);
  }

  @Post()
  @Permission('system:menu:create')
  @SystemAdmin()
  create(@Body() dto: MenuDto) {
    return this.service.create(dto);
  }

  @Patch(':menuId')
  @Permission('system:menu:update')
  @SystemAdmin()
  update(@Param('menuId', UserIdPipe) menuId: bigint, @Body() dto: UpdateMenuDto) {
    return this.service.update(menuId, dto);
  }

  @Delete(':menuId')
  @Permission('system:menu:delete')
  @SystemAdmin()
  remove(@Param('menuId', UserIdPipe) menuId: bigint) {
    return this.service.remove(menuId);
  }
}
