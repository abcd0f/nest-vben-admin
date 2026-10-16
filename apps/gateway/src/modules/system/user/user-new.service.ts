import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@app/database';
import { BcryptUtil, SUPER_ADMIN_USER_ID, PROTECTED_ROLE_KEYS, StatusType, DelFlag } from '@app/common';
import { BusinessException } from '@app/core';
import { LoginUser } from '@app/auth';
import { nextSnowflakeId } from '@app/database';
import { CreateUserDto, UpdateUserDto, QueryUserDto, ResetPasswordDto, ChangeStatusDto, AuthRoleDto } from './dto/user.dto.js';
import { UserVo, UserPageVo, UserInfoVo, TableDataInfo } from './dto/user-response.dto.js';
import { plainToInstance } from 'class-transformer';

/**
 * 用户服务
 * 复刻 RuoYi-Vue-Plus SysUserServiceImpl
 */
@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * 查询用户列表（分页）
   * 对应：selectPageUserList
   */
  async list(query: QueryUserDto, loginUser: LoginUser): Promise<TableDataInfo<UserVo>> {
    const pageNum = query.pageNum || 1;
    const pageSize = query.pageSize || 10;
    const skip = (pageNum - 1) * pageSize;

    // 构建查询条件
    const where: any = {
      delFlag: DelFlag.NORMAL,
      tenantId: loginUser.tenantId,
    };

    if (query.userName) {
      where.userName = { contains: query.userName };
    }

    if (query.phonenumber) {
      where.phonenumber = { contains: query.phonenumber };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.deptId) {
      where.deptId = BigInt(query.deptId);
    }

    if (query.beginTime && query.endTime) {
      where.createTime = {
        gte: new Date(query.beginTime),
        lte: new Date(query.endTime),
      };
    }

    // TODO: 应用数据范围过滤（基于 loginUser 的角色数据权限）

    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createTime: 'desc' },
        include: {
          dept: {
            select: {
              deptId: true,
              deptName: true,
              leader: true,
            },
          },
        },
      }),
      this.db.user.count({ where }),
    ]);

    // 转换为VO
    const voList = rows.map((user) => this.convertToVo(user));

    return {
      total,
      rows: voList,
      code: 200,
      msg: '查询成功',
    };
  }

  /**
   * 查询用户详情
   * 对应：selectUserById
   */
  async getInfo(userId: bigint, loginUser: LoginUser): Promise<UserVo> {
    // TODO: 检查数据范围权限

    const user = await this.db.user.findFirst({
      where: {
        userId,
        delFlag: DelFlag.NORMAL,
        tenantId: loginUser.tenantId,
      },
      include: {
        dept: {
          select: {
            deptId: true,
            deptName: true,
            leader: true,
          },
        },
        roles: {
          include: {
            role: {
              select: {
                roleId: true,
                roleName: true,
                roleKey: true,
                roleSort: true,
                dataScope: true,
                status: true,
              },
            },
          },
        },
        posts: {
          include: {
            post: {
              select: {
                postId: true,
                postCode: true,
                postName: true,
                postSort: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw BusinessException.notFound('用户不存在');
    }

    const vo = this.convertToVo(user);

    // 添加角色和岗位信息
    vo.roles = user.roles.map((ur) => ({
      roleId: ur.role.roleId.toString(),
      roleName: ur.role.roleName,
      roleKey: ur.role.roleKey,
      roleSort: ur.role.roleSort,
      dataScope: ur.role.dataScope,
      status: ur.role.status,
    }));

    vo.roleIds = vo.roles.map((r) => r.roleId);

    vo.posts = user.posts.map((up) => ({
      postId: up.post.postId.toString(),
      postCode: up.post.postCode,
      postName: up.post.postName,
      postSort: up.post.postSort,
      status: up.post.status,
    }));

    vo.postIds = vo.posts.map((p) => p.postId);

    return vo;
  }

  /**
   * 新增用户
   * 对应：insertUser
   */
  async create(dto: CreateUserDto, loginUser: LoginUser): Promise<UserVo> {
    // 校验用户名唯一性
    await this.checkUserNameUnique(dto.userName, loginUser.tenantId);

    // 校验邮箱唯一性
    if (dto.email) {
      await this.checkEmailUnique(dto.email, loginUser.tenantId);
    }

    // 校验手机号唯一性
    if (dto.phonenumber) {
      await this.checkPhoneUnique(dto.phonenumber, loginUser.tenantId);
    }

    // 校验部门是否存在
    if (dto.deptId) {
      await this.checkDeptExists(BigInt(dto.deptId), loginUser.tenantId);
    }

    // 加密密码
    const hashedPassword = await BcryptUtil.hashPassword(dto.password);

    // 生成用户ID
    const userId = nextSnowflakeId();

    // 开启事务
    const user = await this.db.$transaction(async (tx) => {
      // 创建用户
      const newUser = await tx.user.create({
        data: {
          userId,
          tenantId: loginUser.tenantId,
          userName: dto.userName,
          nickName: dto.nickName,
          userType: dto.userType || '00',
          email: dto.email || null,
          phonenumber: dto.phonenumber || null,
          sex: dto.sex || '0',
          avatar: dto.avatar ? BigInt(dto.avatar) : null,
          password: hashedPassword,
          status: dto.status || StatusType.NORMAL,
          deptId: dto.deptId ? BigInt(dto.deptId) : null,
          createDept: loginUser.deptId || null,
          createBy: loginUser.userId,
          remark: dto.remark || null,
        },
      });

      // 新增用户岗位关联
      if (dto.postIds && dto.postIds.length > 0) {
        await tx.userPost.createMany({
          data: dto.postIds.map((postId) => ({
            userId,
            postId: BigInt(postId),
          })),
        });
      }

      // 新增用户角色关联
      if (dto.roleIds && dto.roleIds.length > 0) {
        // 校验角色
        await this.checkRoleAllowed(dto.roleIds, loginUser);

        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            userId,
            roleId: BigInt(roleId),
          })),
        });
      }

      return newUser;
    });

    return this.convertToVo(user);
  }

  /**
   * 修改用户
   * 对应：updateUser
   */
  async update(userId: bigint, dto: UpdateUserDto, loginUser: LoginUser): Promise<UserVo> {
    // TODO: 检查数据范围权限

    // 查询用户是否存在
    const existUser = await this.db.user.findFirst({
      where: {
        userId,
        delFlag: DelFlag.NORMAL,
        tenantId: loginUser.tenantId,
      },
    });

    if (!existUser) {
      throw BusinessException.notFound('用户不存在');
    }

    // 不允许操作超级管理员用户
    if (userId === SUPER_ADMIN_USER_ID && loginUser.userId !== SUPER_ADMIN_USER_ID) {
      throw BusinessException.forbidden('不允许操作超级管理员用户');
    }

    // 校验用户名唯一性
    if (dto.userName && dto.userName !== existUser.userName) {
      await this.checkUserNameUnique(dto.userName, loginUser.tenantId, userId);
    }

    // 校验邮箱唯一性
    if (dto.email && dto.email !== existUser.email) {
      await this.checkEmailUnique(dto.email, loginUser.tenantId, userId);
    }

    // 校验手机号唯一性
    if (dto.phonenumber && dto.phonenumber !== existUser.phonenumber) {
      await this.checkPhoneUnique(dto.phonenumber, loginUser.tenantId, userId);
    }

    // 校验部门
    if (dto.deptId) {
      await this.checkDeptExists(BigInt(dto.deptId), loginUser.tenantId);
    }

    // 开启事务
    const user = await this.db.$transaction(async (tx) => {
      // 更新用户基本信息
      const updateData: any = {
        updateBy: loginUser.userId,
        updateTime: new Date(),
      };

      if (dto.userName) updateData.userName = dto.userName;
      if (dto.nickName !== undefined) updateData.nickName = dto.nickName;
      if (dto.userType !== undefined) updateData.userType = dto.userType;
      if (dto.email !== undefined) updateData.email = dto.email;
      if (dto.phonenumber !== undefined) updateData.phonenumber = dto.phonenumber;
      if (dto.sex !== undefined) updateData.sex = dto.sex;
      if (dto.avatar !== undefined) updateData.avatar = dto.avatar ? BigInt(dto.avatar) : null;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.deptId !== undefined) updateData.deptId = dto.deptId ? BigInt(dto.deptId) : null;
      if (dto.remark !== undefined) updateData.remark = dto.remark;

      const updatedUser = await tx.user.update({
        where: { userId },
        data: updateData,
      });

      // 更新用户岗位关联
      if (dto.postIds !== undefined) {
        // 删除旧关联
        await tx.userPost.deleteMany({
          where: { userId },
        });

        // 新增新关联
        if (dto.postIds.length > 0) {
          await tx.userPost.createMany({
            data: dto.postIds.map((postId) => ({
              userId,
              postId: BigInt(postId),
            })),
          });
        }
      }

      // 更新用户角色关联
      if (dto.roleIds !== undefined) {
        // 校验角色
        await this.checkRoleAllowed(dto.roleIds, loginUser);

        // 删除旧关联
        await tx.userRole.deleteMany({
          where: { userId },
        });

        // 新增新关联
        if (dto.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({
              userId,
              roleId: BigInt(roleId),
            })),
          });
        }
      }

      return updatedUser;
    });

    return this.convertToVo(user);
  }

  /**
   * 删除用户（软删除）
   * 对应：deleteUserById
   */
  async remove(userIds: string[], loginUser: LoginUser): Promise<void> {
    const ids = userIds.map((id) => BigInt(id));

    // TODO: 检查数据范围权限

    // 不允许删除超级管理员
    if (ids.includes(SUPER_ADMIN_USER_ID)) {
      throw BusinessException.forbidden('不允许删除超级管理员用户');
    }

    // 不允许删除当前用户
    if (ids.includes(loginUser.userId)) {
      throw BusinessException.forbidden('不允许删除当前登录用户');
    }

    await this.db.user.updateMany({
      where: {
        userId: { in: ids },
        tenantId: loginUser.tenantId,
        delFlag: DelFlag.NORMAL,
      },
      data: {
        delFlag: DelFlag.DELETED,
        updateBy: loginUser.userId,
        updateTime: new Date(),
      },
    });
  }

  /**
   * 重置用户密码
   * 对应：resetUserPwd
   */
  async resetPassword(userId: bigint, dto: ResetPasswordDto, loginUser: LoginUser): Promise<void> {
    // TODO: 检查数据范围权限

    // 查询用户是否存在
    const user = await this.db.user.findFirst({
      where: {
        userId,
        delFlag: DelFlag.NORMAL,
        tenantId: loginUser.tenantId,
      },
    });

    if (!user) {
      throw BusinessException.notFound('用户不存在');
    }

    // 不允许操作超级管理员用户
    if (userId === SUPER_ADMIN_USER_ID && loginUser.userId !== SUPER_ADMIN_USER_ID) {
      throw BusinessException.forbidden('不允许操作超级管理员用户');
    }

    // 加密新密码
    const hashedPassword = await BcryptUtil.hashPassword(dto.password);

    await this.db.user.update({
      where: { userId },
      data: {
        password: hashedPassword,
        updateBy: loginUser.userId,
        updateTime: new Date(),
      },
    });
  }

  /**
   * 修改用户状态
   * 对应：updateUserStatus
   */
  async changeStatus(userId: bigint, dto: ChangeStatusDto, loginUser: LoginUser): Promise<void> {
    // TODO: 检查数据范围权限

    // 查询用户是否存在
    const user = await this.db.user.findFirst({
      where: {
        userId,
        delFlag: DelFlag.NORMAL,
        tenantId: loginUser.tenantId,
      },
    });

    if (!user) {
      throw BusinessException.notFound('用户不存在');
    }

    // 不允许操作超级管理员用户
    if (userId === SUPER_ADMIN_USER_ID && loginUser.userId !== SUPER_ADMIN_USER_ID) {
      throw BusinessException.forbidden('不允许操作超级管理员用户');
    }

    await this.db.user.update({
      where: { userId },
      data: {
        status: dto.status,
        updateBy: loginUser.userId,
        updateTime: new Date(),
      },
    });
  }

  /**
   * 校验用户名是否唯一
   */
  private async checkUserNameUnique(userName: string, tenantId: string, userId?: bigint): Promise<void> {
    const where: any = {
      userName,
      tenantId,
    };

    if (userId) {
      where.userId = { not: userId };
    }

    const count = await this.db.user.count({ where });

    if (count > 0) {
      throw BusinessException.conflict('用户账号已存在');
    }
  }

  /**
   * 校验邮箱是否唯一
   */
  private async checkEmailUnique(email: string, tenantId: string, userId?: bigint): Promise<void> {
    const where: any = {
      email,
      tenantId,
    };

    if (userId) {
      where.userId = { not: userId };
    }

    const count = await this.db.user.count({ where });

    if (count > 0) {
      throw BusinessException.conflict('用户邮箱已存在');
    }
  }

  /**
   * 校验手机号是否唯一
   */
  private async checkPhoneUnique(phonenumber: string, tenantId: string, userId?: bigint): Promise<void> {
    const where: any = {
      phonenumber,
      tenantId,
    };

    if (userId) {
      where.userId = { not: userId };
    }

    const count = await this.db.user.count({ where });

    if (count > 0) {
      throw BusinessException.conflict('手机号码已存在');
    }
  }

  /**
   * 校验部门是否存在
   */
  private async checkDeptExists(deptId: bigint, tenantId: string): Promise<void> {
    const dept = await this.db.dept.findFirst({
      where: {
        deptId,
        tenantId,
        delFlag: DelFlag.NORMAL,
        status: StatusType.NORMAL,
      },
    });

    if (!dept) {
      throw BusinessException.badRequest('部门不存在或已停用');
    }
  }

  /**
   * 校验角色是否允许操作
   */
  private async checkRoleAllowed(roleIds: string[], loginUser: LoginUser): Promise<void> {
    const ids = roleIds.map((id) => BigInt(id));

    const roles = await this.db.role.findMany({
      where: {
        roleId: { in: ids },
        tenantId: loginUser.tenantId,
        delFlag: DelFlag.NORMAL,
      },
    });

    // 校验角色是否存在
    if (roles.length !== roleIds.length) {
      throw BusinessException.badRequest('部分角色不存在');
    }

    // 非超级管理员不能分配超级管理员角色
    if (loginUser.userId !== SUPER_ADMIN_USER_ID) {
      const hasProtectedRole = roles.some((role) => PROTECTED_ROLE_KEYS.includes(role.roleKey));
      if (hasProtectedRole) {
        throw BusinessException.forbidden('不允许分配超级管理员角色');
      }
    }
  }

  /**
   * 转换为VO对象
   */
  private convertToVo(user: any): UserVo {
    const vo: UserVo = {
      userId: user.userId.toString(),
      tenantId: user.tenantId,
      deptId: user.deptId?.toString(),
      userName: user.userName,
      nickName: user.nickName,
      userType: user.userType,
      email: user.email,
      phonenumber: user.phonenumber,
      sex: user.sex,
      avatar: user.avatar?.toString(),
      status: user.status,
      delFlag: user.delFlag,
      loginIp: user.loginIp,
      loginDate: user.loginDate,
      createDept: user.createDept?.toString(),
      createBy: user.createBy?.toString(),
      createTime: user.createTime,
      updateBy: user.updateBy?.toString(),
      updateTime: user.updateTime,
      remark: user.remark,
    };

    // 添加部门信息
    if (user.dept) {
      vo.dept = {
        deptId: user.dept.deptId.toString(),
        deptName: user.dept.deptName,
        leader: user.dept.leader,
      };
    }

    return vo;
  }
}
