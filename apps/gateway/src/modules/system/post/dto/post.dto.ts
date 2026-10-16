import { IsIn, IsInt, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/** 岗位不授予权限，权限仍由角色和菜单关系计算。 */
export class PostDto {
  @IsString()
  @Matches(/^\d+$/)
  deptId!: string;

  @IsString()
  @Length(1, 64)
  @Matches(/\S/)
  postCode!: string;

  @IsString()
  @Length(1, 50)
  @Matches(/\S/)
  postName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  postCategory?: string;

  @IsInt()
  postSort!: number;

  /** 岗位状态：0 正常，1 停用。 */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
