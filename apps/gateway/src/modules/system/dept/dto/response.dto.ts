import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class DeptResponseDto {
  @Expose() @Transform(({ value }) => value.toString()) deptId!: string;
  @Expose() @Transform(({ value }) => value?.toString() ?? null) parentId!: null | string;
  @Expose() deptName!: string;
  @Expose() sortOrder!: number;
  @Expose() status!: number;
  @Expose() createdTime!: Date;
  @Expose() updatedTime!: Date;
}
