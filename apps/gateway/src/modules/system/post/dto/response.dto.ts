import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class PostResponseDto {
  @Expose()
  @Transform(({ value }) => value.toString())
  postId!: string;

  @Expose()
  postCode!: string;

  @Expose()
  postName!: string;

  @Expose()
  sortOrder!: number;

  @Expose()
  status!: number;

  @Expose()
  createdTime!: Date;

  @Expose()
  updatedTime!: Date;
}
