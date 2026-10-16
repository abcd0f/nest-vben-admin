import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class PostResponseDto {
  @Expose()
  @Transform(({ value }) => value.toString())
  postId!: string;

  @Expose()
  @Transform(({ value }) => value?.toString() ?? null)
  deptId!: string | null;

  @Expose()
  postCode!: string;

  @Expose()
  postName!: string;

  @Expose()
  postCategory!: string | null;

  @Expose()
  postSort!: number;

  @Expose()
  status!: string;

  @Expose()
  remark!: string | null;

  @Expose()
  createTime!: Date;
}
