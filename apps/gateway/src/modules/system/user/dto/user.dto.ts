import { IsNotEmpty, IsOptional, IsString, IsIn, Length, IsEmail, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 创建用户DTO
 * 复刻 RuoYi-Vue-Plus SysUserBo
 */
export class CreateUserDto {
  @ApiProperty({ description: '用户账号', example: 'zhangsan' })
  @IsNotEmpty({ message: '用户账号不能为空' })
  @Length(2, 30, { message: '用户账号长度必须介于 2 和 30 之间' })
  userName: string;

  @ApiProperty({ description: '用户昵称', example: '张三' })
  @IsNotEmpty({ message: '用户昵称不能为空' })
  @MaxLength(30, { message: '用户昵称长度不能超过30个字符' })
  nickName: string;

  @ApiPropertyOptional({ description: '用户类型', example: '00' })
  @IsOptional()
  @MaxLength(10, { message: '用户类型长度不能超过10个字符' })
  userType?: string;

  @ApiPropertyOptional({ description: '用户邮箱', example: 'zhangsan@example.com' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(50, { message: '邮箱长度不能超过50个字符' })
  email?: string;

  @ApiPropertyOptional({ description: '手机号码', example: '13800138000' })
  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号码格式不正确' })
  phonenumber?: string;

  @ApiPropertyOptional({ description: '用户性别：0 男 1 女 2 未知', example: '0' })
  @IsOptional()
  @IsIn(['0', '1', '2'], { message: '用户性别必须为 0、1 或 2' })
  sex?: string;

  @ApiPropertyOptional({ description: '头像OSS对象ID', example: '123456789' })
  @IsOptional()
  avatar?: string;

  @ApiProperty({ description: '用户密码', example: 'Admin@123' })
  @IsNotEmpty({ message: '用户密码不能为空' })
  @Length(5, 20, { message: '用户密码长度必须介于 5 和 20 之间' })
  password: string;

  @ApiPropertyOptional({ description: '部门ID', example: '1' })
  @IsOptional()
  deptId?: string;

  @ApiPropertyOptional({ description: '岗位ID列表', example: ['1', '2'] })
  @IsOptional()
  postIds?: string[];

  @ApiPropertyOptional({ description: '角色ID列表', example: ['1', '2'] })
  @IsOptional()
  roleIds?: string[];

  @ApiPropertyOptional({ description: '用户状态：0 正常 1 停用', example: '0' })
  @IsOptional()
  @IsIn(['0', '1'], { message: '用户状态必须为 0 或 1' })
  status?: string;

  @ApiPropertyOptional({ description: '备注', example: '测试用户' })
  @IsOptional()
  @MaxLength(500, { message: '备注长度不能超过500个字符' })
  remark?: string;
}

/**
 * 更新用户DTO
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ description: '用户账号', example: 'zhangsan' })
  @IsOptional()
  @Length(2, 30, { message: '用户账号长度必须介于 2 和 30 之间' })
  userName?: string;

  @ApiPropertyOptional({ description: '用户昵称', example: '张三' })
  @IsOptional()
  @MaxLength(30, { message: '用户昵称长度不能超过30个字符' })
  nickName?: string;

  @ApiPropertyOptional({ description: '用户类型', example: '00' })
  @IsOptional()
  @MaxLength(10, { message: '用户类型长度不能超过10个字符' })
  userType?: string;

  @ApiPropertyOptional({ description: '用户邮箱', example: 'zhangsan@example.com' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(50, { message: '邮箱长度不能超过50个字符' })
  email?: string;

  @ApiPropertyOptional({ description: '手机号码', example: '13800138000' })
  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号码格式不正确' })
  phonenumber?: string;

  @ApiPropertyOptional({ description: '用户性别：0 男 1 女 2 未知', example: '0' })
  @IsOptional()
  @IsIn(['0', '1', '2'], { message: '用户性别必须为 0、1 或 2' })
  sex?: string;

  @ApiPropertyOptional({ description: '头像OSS对象ID', example: '123456789' })
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({ description: '部门ID', example: '1' })
  @IsOptional()
  deptId?: string;

  @ApiPropertyOptional({ description: '岗位ID列表', example: ['1', '2'] })
  @IsOptional()
  postIds?: string[];

  @ApiPropertyOptional({ description: '角色ID列表', example: ['1', '2'] })
  @IsOptional()
  roleIds?: string[];

  @ApiPropertyOptional({ description: '用户状态：0 正常 1 停用', example: '0' })
  @IsOptional()
  @IsIn(['0', '1'], { message: '用户状态必须为 0 或 1' })
  status?: string;

  @ApiPropertyOptional({ description: '备注', example: '测试用户' })
  @IsOptional()
  @MaxLength(500, { message: '备注长度不能超过500个字符' })
  remark?: string;
}

/**
 * 查询用户DTO
 */
export class QueryUserDto {
  @ApiPropertyOptional({ description: '用户账号', example: 'zhangsan' })
  @IsOptional()
  userName?: string;

  @ApiPropertyOptional({ description: '手机号码', example: '13800138000' })
  @IsOptional()
  phonenumber?: string;

  @ApiPropertyOptional({ description: '用户状态：0 正常 1 停用', example: '0' })
  @IsOptional()
  @IsIn(['0', '1'], { message: '用户状态必须为 0 或 1' })
  status?: string;

  @ApiPropertyOptional({ description: '部门ID', example: '1' })
  @IsOptional()
  deptId?: string;

  @ApiPropertyOptional({ description: '开始时间', example: '2024-01-01' })
  @IsOptional()
  beginTime?: string;

  @ApiPropertyOptional({ description: '结束时间', example: '2024-12-31' })
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  pageNum?: number;

  @ApiPropertyOptional({ description: '每页大小', example: 10 })
  @IsOptional()
  pageSize?: number;
}

/**
 * 重置密码DTO
 */
export class ResetPasswordDto {
  @ApiProperty({ description: '新密码', example: 'Admin@123' })
  @IsNotEmpty({ message: '新密码不能为空' })
  @Length(5, 20, { message: '密码长度必须介于 5 和 20 之间' })
  password: string;
}

/**
 * 修改状态DTO
 */
export class ChangeStatusDto {
  @ApiProperty({ description: '用户状态：0 正常 1 停用', example: '0' })
  @IsNotEmpty({ message: '用户状态不能为空' })
  @IsIn(['0', '1'], { message: '用户状态必须为 0 或 1' })
  status: string;
}

/**
 * 用户授权角色DTO
 */
export class AuthRoleDto {
  @ApiProperty({ description: '角色ID列表', example: ['1', '2'] })
  @IsNotEmpty({ message: '角色ID列表不能为空' })
  roleIds: string[];
}
