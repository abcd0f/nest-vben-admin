import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

/**
 * 用户响应DTO
 * 复刻 RuoYi-Vue-Plus SysUserVo
 */
export class UserVo {
  @ApiProperty({ description: '用户ID' })
  @Expose()
  userId: string;

  @ApiProperty({ description: '租户ID' })
  @Expose()
  tenantId: string;

  @ApiProperty({ description: '部门ID' })
  @Expose()
  deptId?: string;

  @ApiProperty({ description: '用户账号' })
  @Expose()
  userName: string;

  @ApiProperty({ description: '用户昵称' })
  @Expose()
  nickName: string;

  @ApiProperty({ description: '用户类型' })
  @Expose()
  userType?: string;

  @ApiProperty({ description: '用户邮箱' })
  @Expose()
  email?: string;

  @ApiProperty({ description: '手机号码' })
  @Expose()
  phonenumber?: string;

  @ApiProperty({ description: '用户性别' })
  @Expose()
  sex?: string;

  @ApiProperty({ description: '头像OSS对象ID' })
  @Expose()
  avatar?: string;

  @ApiProperty({ description: '用户状态' })
  @Expose()
  status: string;

  @ApiProperty({ description: '删除标志' })
  @Expose()
  delFlag: string;

  @ApiProperty({ description: '最后登录IP' })
  @Expose()
  loginIp?: string;

  @ApiProperty({ description: '最后登录时间' })
  @Expose()
  loginDate?: Date;

  @ApiProperty({ description: '创建部门' })
  @Expose()
  createDept?: string;

  @ApiProperty({ description: '创建者' })
  @Expose()
  createBy?: string;

  @ApiProperty({ description: '创建时间' })
  @Expose()
  createTime: Date;

  @ApiProperty({ description: '更新者' })
  @Expose()
  updateBy?: string;

  @ApiProperty({ description: '更新时间' })
  @Expose()
  updateTime: Date;

  @ApiProperty({ description: '备注' })
  @Expose()
  remark?: string;

  @ApiProperty({ description: '部门对象' })
  @Expose()
  @Type(() => DeptVo)
  dept?: DeptVo;

  @ApiProperty({ description: '角色对象列表' })
  @Expose()
  @Type(() => RoleVo)
  roles?: RoleVo[];

  @ApiProperty({ description: '角色ID列表' })
  @Expose()
  roleIds?: string[];

  @ApiProperty({ description: '岗位ID列表' })
  @Expose()
  postIds?: string[];

  @ApiProperty({ description: '岗位对象列表' })
  @Expose()
  @Type(() => PostVo)
  posts?: PostVo[];

  @Exclude()
  password?: string;
}

/**
 * 部门简要信息
 */
export class DeptVo {
  @Expose()
  deptId: string;

  @Expose()
  deptName: string;

  @Expose()
  leader?: string;
}

/**
 * 角色简要信息
 */
export class RoleVo {
  @Expose()
  roleId: string;

  @Expose()
  roleName: string;

  @Expose()
  roleKey: string;

  @Expose()
  roleSort: number;

  @Expose()
  dataScope: string;

  @Expose()
  status: string;
}

/**
 * 岗位简要信息
 */
export class PostVo {
  @Expose()
  postId: string;

  @Expose()
  postCode: string;

  @Expose()
  postName: string;

  @Expose()
  postSort: number;

  @Expose()
  status: string;
}

/**
 * 分页响应
 */
export class TableDataInfo<T> {
  @ApiProperty({ description: '总记录数' })
  total: number;

  @ApiProperty({ description: '列表数据' })
  rows: T[];

  @ApiProperty({ description: '状态码' })
  code: number;

  @ApiProperty({ description: '消息' })
  msg: string;
}

/**
 * 用户分页响应
 */
export class UserPageVo extends TableDataInfo<UserVo> {
  @Type(() => UserVo)
  rows: UserVo[];
}

/**
 * 用户信息响应（getInfo接口）
 */
export class UserInfoVo {
  @ApiProperty({ description: '用户信息' })
  @Type(() => UserVo)
  user: UserVo;

  @ApiProperty({ description: '角色列表' })
  roles: string[];

  @ApiProperty({ description: '权限列表' })
  permissions: string[];
}
