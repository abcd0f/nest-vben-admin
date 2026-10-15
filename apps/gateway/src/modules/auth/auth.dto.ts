import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  @Length(6, 64)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(6, 64)
  currentPassword!: string;

  @IsString()
  @Length(6, 64)
  newPassword!: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(6, 64)
  newPassword!: string;
}
