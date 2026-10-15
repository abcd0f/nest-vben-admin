import { Exclude, Expose, Transform } from 'class-transformer';
import { MenuType } from './menu.dto.js';

@Exclude()
export class MenuResponseDto {
  @Expose() @Transform(({ value }) => value.toString()) menuId!: string;
  @Expose() @Transform(({ value }) => value?.toString() ?? null) parentId!: string | null;
  @Expose() menuType!: MenuType;
  @Expose() menuName!: string;
  @Expose() routePath!: string | null;
  @Expose() component!: string | null;
  @Expose() permissionCode!: string | null;
  @Expose() sortOrder!: number;
  @Expose() status!: number;
  @Expose() createdTime!: Date;
  @Expose() updatedTime!: Date;
}
