import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserIdPipe } from '../user/user-id.pipe.js';
import { MenuDto, UpdateMenuDto } from './menu.dto.js';
import { MenuService } from './menu.service.js';

@Controller('system/menu')
export class MenuController {
  constructor(private readonly service: MenuService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(':menuId') findOne(@Param('menuId', UserIdPipe) menuId: bigint) { return this.service.findOne(menuId); }
  @Post() create(@Body() dto: MenuDto) { return this.service.create(dto); }
  @Patch(':menuId') update(@Param('menuId', UserIdPipe) menuId: bigint, @Body() dto: UpdateMenuDto) { return this.service.update(menuId, dto); }
  @Delete(':menuId') remove(@Param('menuId', UserIdPipe) menuId: bigint) { return this.service.remove(menuId); }
}
