import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'auth:public';
export const AUTH_ONLY_KEY = 'auth:only';
export const CURRENT_USER_KEY = 'auth:current-user';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const AuthOnly = () => SetMetadata(AUTH_ONLY_KEY, true);
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<{ user: { userId: bigint } }>().user;
});
