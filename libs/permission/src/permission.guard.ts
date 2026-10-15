import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessException } from '@app/core';
import { AUTH_ONLY_KEY, PUBLIC_KEY } from '@app/auth';
import { PermissionService } from './permission.service.js';
import { PERMISSION_KEY, SYSTEM_ADMIN_KEY } from './permission.decorators.js';

@Injectable()
export class PermissionGuard {
  constructor(private readonly reflector: Reflector, private readonly permissions: PermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    if (this.reflector.getAllAndOverride<boolean>(AUTH_ONLY_KEY, [context.getHandler(), context.getClass()])) return true;
    const code = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!code) throw BusinessException.forbidden('接口未声明权限');
    const request = context.switchToHttp().getRequest<{ user?: { userId: bigint } }>();
    if (!request.user || !(await this.permissions.hasPermission(request.user.userId, code))) throw BusinessException.forbidden();
    if (this.reflector.getAllAndOverride<boolean>(SYSTEM_ADMIN_KEY, [context.getHandler(), context.getClass()]) && !(await this.permissions.isSystemAdmin(request.user.userId))) {
      throw BusinessException.forbidden('需要系统管理员权限');
    }
    return true;
  }
}
