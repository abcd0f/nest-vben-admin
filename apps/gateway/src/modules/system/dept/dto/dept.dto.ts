import { IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/** 部门业务字段；租户和操作者由服务端上下文填充。 */
export class DeptDto {
  @IsString()
  @Length(1, 30)
  @Matches(/\S/)
  deptName!: string;

  @IsString()
  @Matches(/^\d+$/)
  parentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deptCategory?: string;

  @IsInt()
  orderNum!: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  leader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(11)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(50)
  email?: string;

  /** 部门状态：0 正常，1 停用。 */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;
}
