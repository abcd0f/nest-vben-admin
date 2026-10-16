import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class DeptResponseDto {
  @Expose()
  @Transform(({ value }) => value.toString())
  deptId!: string;

  @Expose()
  @Transform(({ value }) => value?.toString() ?? null)
  parentId!: string | null;

  @Expose()
  parentName?: string | null;

  @Expose()
  ancestors!: string;

  @Expose()
  deptName!: string;

  @Expose()
  deptCategory!: string | null;

  @Expose()
  orderNum!: number;

  @Expose()
  @Transform(({ value }) => value?.toString() ?? null)
  leader!: string | null;

  @Expose()
  phone!: string | null;

  @Expose()
  email!: string | null;

  @Expose()
  status!: string;

  @Expose()
  createTime!: Date;
}
