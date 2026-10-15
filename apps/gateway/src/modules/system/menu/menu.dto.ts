import { MenuType } from '@app/database/generated/prisma/client.js';
import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export { MenuType };

export class MenuDto {
  @IsOptional() @IsString() @Matches(/^[1-9]\d*$/) parentId?: string | null;
  @IsEnum(MenuType) menuType!: MenuType;
  @IsString() @Length(1, 64) menuName!: string;
  @IsOptional() @IsString() @Length(1, 255) routePath?: string | null;
  @IsOptional() @IsString() @Length(1, 255) component?: string | null;
  @IsOptional() @IsString() @Length(1, 128) permissionCode?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(32767) sortOrder?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1) status?: number;
}

export class UpdateMenuDto {
  @IsOptional() @IsString() @Matches(/^[1-9]\d*$/) parentId?: string | null;
  @IsOptional() @IsEnum(MenuType) menuType?: MenuType;
  @IsOptional() @IsString() @Length(1, 64) menuName?: string;
  @IsOptional() @IsString() @Length(1, 255) routePath?: string | null;
  @IsOptional() @IsString() @Length(1, 255) component?: string | null;
  @IsOptional() @IsString() @Length(1, 128) permissionCode?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(32767) sortOrder?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1) status?: number;
}
