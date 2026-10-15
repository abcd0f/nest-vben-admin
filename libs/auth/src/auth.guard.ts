import { BusinessException } from '@app/core';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from './auth.decorators.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: { userId: bigint } }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw BusinessException.unauthorized();
    const identity = this.auth.verifyToken(header.slice(7));
    await this.auth.assertActiveUser(identity.userId);
    request.user = identity;
    return true;
  }
}
