import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class PostDto {
  @IsString()
  @Length(1, 64)
  postCode!: string;

  @IsString()
  @Length(1, 64)
  postName!: string;

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
