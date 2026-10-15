import { DataScope } from '@app/database/generated/prisma/client.js';
import { Exclude, Expose, Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export { DataScope };

export class CreateRoleDto {
  @IsString()
  @Length(1, 64)
  roleCode!: string;

  @IsString()
  @Length(1, 64)
  roleName!: string;

  @IsOptional()
  @IsEnum(DataScope)
  dataScope?: DataScope;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  roleName?: string;

  @IsOptional()
  @IsEnum(DataScope)
  dataScope?: DataScope;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

class IdListDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[1-9]\d*$/, { each: true })
  ids!: string[];
}

@Exclude()
export class RoleResponseDto {
  @Expose() @Transform(({ value }) => value.toString()) roleId!: string;
  @Expose() roleCode!: string;
  @Expose() roleName!: string;
  @Expose() dataScope!: DataScope;
  @Expose() status!: number;
  @Expose() isSystem!: boolean;
  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;
}

export class ReplaceIdsDto extends IdListDto {}
