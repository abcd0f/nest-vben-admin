import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class DeptDto {
  @IsString()
  @Length(1, 64)
  deptName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}
